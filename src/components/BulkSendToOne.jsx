import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Send,
  ArrowRight,
  Wallet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Zap,
  KeyRound,
  ClipboardPaste,
  Flame
} from 'lucide-react';
import {
  validateAddress,
  formatAddress,
  calculateMaxNativeSendable,
  sendNativeTransferFromPk,
  getProvider
} from '../services/wallet';
import { fetchNativeBalance } from '../services/blockscout';
import { ethers } from 'ethers';

export const BulkSendToOne = ({
  network,
  networks = [],
  storedWallets = [],
  onNotify,
  onOpenNetworkModal
}) => {
  // Target Recipient Address
  const [recipientAddress, setRecipientAddress] = useState('');
  const isRecipientValid = useMemo(() => validateAddress(recipientAddress), [recipientAddress]);

  // Selected Network for sending (Default: active network, usually MTT or BSC)
  const [selectedNetworkId, setSelectedNetworkId] = useState(network.id);
  const activeNetwork = useMemo(() => {
    return networks.find((n) => n.id === selectedNetworkId) || network;
  }, [networks, selectedNetworkId, network]);

  // Input raw Private Keys textarea
  const [rawPrivateKeys, setRawPrivateKeys] = useState('');

  // Wallets Queue list for bulk send:
  // Array of: { id, privateKey, address, balance, balanceNum, amountToSend, status: 'idle'|'sending'|'success'|'error', txHash, errorMsg }
  const [sendQueue, setSendQueue] = useState([]);

  // Loading states
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });

  // Quick Amount config
  const [uniformAmount, setUniformAmount] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Gas Estimation info
  const [estimatedGasFeePerTx, setEstimatedGasFeePerTx] = useState('0.00024');

  // Copy helper
  const handleCopy = (text, id, msg = 'Disalin!') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onNotify?.(msg, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Paste clipboard to recipient
  const handlePasteRecipient = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRecipientAddress(text.trim());
        if (validateAddress(text.trim())) {
          onNotify?.('Alamat penerima valid!', 'success');
        } else {
          onNotify?.('Format alamat tidak valid (harus 0x...)', 'error');
        }
      }
    } catch {
      onNotify?.('Gagal membaca clipboard', 'error');
    }
  };

  // Query gas fee for active network
  useEffect(() => {
    const fetchGasInfo = async () => {
      try {
        const provider = getProvider(activeNetwork);
        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits('12', 'gwei');
        const costWei = 21000n * gasPrice;
        setEstimatedGasFeePerTx(ethers.formatEther(costWei));
      } catch (e) {
        setEstimatedGasFeePerTx('0.00025');
      }
    };
    fetchGasInfo();
  }, [activeNetwork]);

  // Parse raw text into wallets list & fetch balances
  const handleLoadPrivateKeys = useCallback(async (pksText) => {
    const lines = (pksText || rawPrivateKeys)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      onNotify?.('Masukkan minimal 1 Private Key.', 'warning');
      return;
    }

    const validItems = [];
    const seenPks = new Set();

    for (let i = 0; i < lines.length; i++) {
      let key = lines[i].replace(/["',;]/g, '').trim();
      if (!key.startsWith('0x') && key.length === 64) {
        key = '0x' + key;
      }

      if (key.startsWith('0x') && key.length === 66 && /^0x[0-9a-fA-F]{64}$/.test(key)) {
        if (!seenPks.has(key.toLowerCase())) {
          seenPks.add(key.toLowerCase());
          try {
            const w = new ethers.Wallet(key);
            validItems.push({
              id: `sweep_${Date.now()}_${i}`,
              privateKey: key,
              address: w.address,
              balance: '0.0000',
              balanceNum: 0,
              amountToSend: '',
              status: 'idle',
              txHash: null,
              errorMsg: null
            });
          } catch (e) {
            // skip invalid
          }
        }
      }
    }

    if (validItems.length === 0) {
      onNotify?.('Tidak ada Private Key valid (64 karakter hex diawali 0x).', 'error');
      return;
    }

    setSendQueue(validItems);
    onNotify?.(`Ditemukan ${validItems.length} Private Key. Memuat saldo...`, 'info');

    // Fetch balances
    setIsLoadingBalances(true);
    const chunkSize = 4;
    const updatedList = [...validItems];

    for (let i = 0; i < updatedList.length; i += chunkSize) {
      const chunk = updatedList.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (item) => {
          try {
            const bal = await fetchNativeBalance(item.address, activeNetwork);
            item.balance = bal;
            item.balanceNum = parseFloat(bal) || 0;
          } catch (e) {
            item.balance = '0.0000';
            item.balanceNum = 0;
          }
        })
      );
      setSendQueue([...updatedList]);
    }

    setIsLoadingBalances(false);
    onNotify?.(`Saldo ${activeNetwork.symbol} berhasil dimuat!`, 'success');
  }, [rawPrivateKeys, activeNetwork, onNotify]);

  // Load from stored wallets in app
  const handleLoadFromStoredWallets = () => {
    const withPk = storedWallets.filter((w) => w.privateKey && !w.isWatchOnly);
    if (withPk.length === 0) {
      onNotify?.('Tidak ada wallet dengan Private Key di aplikasi.', 'warning');
      return;
    }
    const pkText = withPk.map((w) => w.privateKey).join('\n');
    setRawPrivateKeys(pkText);
    handleLoadPrivateKeys(pkText);
  };

  // Quick Amount: Set Max for a single row (Balance - Gas Fee)
  const handleSetRowMax = async (rowId) => {
    const row = sendQueue.find((r) => r.id === rowId);
    if (!row) return;

    const { maxAmount, canSend } = await calculateMaxNativeSendable(row.balance, activeNetwork);
    setSendQueue((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, amountToSend: canSend ? maxAmount : '0' } : r))
    );

    if (!canSend) {
      onNotify?.(`Saldo ${formatAddress(row.address, 4, 4)} tidak cukup untuk biaya gas.`, 'warning');
    }
  };

  // Quick Amount: Apply MAX to ALL wallets (Sweep All)
  const handleApplyMaxToAll = async () => {
    if (sendQueue.length === 0) return;
    onNotify?.('Menghitung saldo bersih (Saldo - Gas Fee) untuk semua wallet...', 'info');

    const updated = await Promise.all(
      sendQueue.map(async (row) => {
        const { maxAmount, canSend } = await calculateMaxNativeSendable(row.balance, activeNetwork);
        return {
          ...row,
          amountToSend: canSend ? maxAmount : '0'
        };
      })
    );

    setSendQueue(updated);
    onNotify?.('Nominal Max (bersih setelah gas) diterapkan ke semua wallet!', 'success');
  };

  // Quick Amount: Apply Uniform Amount to All wallets
  const handleApplyUniformAmount = () => {
    const num = parseFloat(uniformAmount);
    if (isNaN(num) || num <= 0) {
      onNotify?.('Masukkan nominal seragam yang valid (> 0).', 'error');
      return;
    }

    setSendQueue((prev) =>
      prev.map((row) => ({
        ...row,
        amountToSend: uniformAmount.trim()
      }))
    );
    onNotify?.(`Nominal ${uniformAmount} ${activeNetwork.symbol} diterapkan ke semua wallet!`, 'success');
  };

  // Change amount for a specific row
  const handleRowAmountChange = (rowId, val) => {
    setSendQueue((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, amountToSend: val } : r))
    );
  };

  // Delete row
  const handleDeleteRow = (rowId) => {
    setSendQueue((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Calculate Totals
  const totalAmountToSend = useMemo(() => {
    return sendQueue.reduce((acc, curr) => acc + (parseFloat(curr.amountToSend) || 0), 0);
  }, [sendQueue]);

  const totalWalletsWithAmount = useMemo(() => {
    return sendQueue.filter((r) => (parseFloat(r.amountToSend) || 0) > 0).length;
  }, [sendQueue]);

  const totalCurrentBalance = useMemo(() => {
    return sendQueue.reduce((acc, curr) => acc + (curr.balanceNum || 0), 0);
  }, [sendQueue]);

  // ==========================================
  // EXECUTE BULK SEND TO ONE RECIPIENT
  // ==========================================
  const handleExecuteBulkSend = async () => {
    if (!isRecipientValid) {
      onNotify?.('Alamat penerima tujuan belum diisi atau tidak valid!', 'error');
      return;
    }

    const itemsToSend = sendQueue.filter((r) => (parseFloat(r.amountToSend) || 0) > 0);
    if (itemsToSend.length === 0) {
      onNotify?.('Tidak ada wallet dengan nominal kirim (> 0).', 'warning');
      return;
    }

    const confirmMsg = `Konfirmasi Kirim Bulk:\n\nKirim total ${totalAmountToSend.toFixed(4)} ${activeNetwork.symbol} dari ${itemsToSend.length} wallet ke alamat:\n${recipientAddress}\n\nBiaya gas ditanggung masing-masing wallet. Lanjutkan?`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsSendingBulk(true);
    setSendProgress({ current: 0, total: itemsToSend.length });

    let successCount = 0;
    let failCount = 0;

    // Process sequentially so nonces and individual wallet balances are tracked cleanly
    for (let i = 0; i < itemsToSend.length; i++) {
      const item = itemsToSend[i];

      // Mark row as sending
      setSendQueue((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, status: 'sending', errorMsg: null } : r))
      );

      try {
        const tx = await sendNativeTransferFromPk({
          privateKey: item.privateKey,
          toAddress: recipientAddress.trim(),
          amount: item.amountToSend,
          network: activeNetwork
        });

        successCount++;
        setSendQueue((prev) =>
          prev.map((r) =>
            r.id === item.id
              ? { ...r, status: 'success', txHash: tx.hash, errorMsg: null }
              : r
          )
        );
      } catch (err) {
        failCount++;
        const errorText = err.reason || err.message || 'Gagal mengirim transaksi';
        setSendQueue((prev) =>
          prev.map((r) =>
            r.id === item.id
              ? { ...r, status: 'error', errorMsg: errorText }
              : r
          )
        );
      }

      setSendProgress({ current: i + 1, total: itemsToSend.length });
    }

    setIsSendingBulk(false);

    if (failCount === 0) {
      onNotify?.(`Sukses! Semua ${successCount} transaksi berhasil dikirim ke penerima.`, 'success');
    } else {
      onNotify?.(`Selesai: ${successCount} sukses, ${failCount} gagal. Periksa status pada tabel.`, 'warning');
    }

    // Refresh balances after 3 seconds
    setTimeout(() => {
      handleRefreshAllBalances();
    }, 3000);
  };

  // Refresh all balances
  const handleRefreshAllBalances = async () => {
    if (sendQueue.length === 0) return;
    setIsLoadingBalances(true);
    const updated = [...sendQueue];
    for (let i = 0; i < updated.length; i += 4) {
      const chunk = updated.slice(i, i + 4);
      await Promise.all(
        chunk.map(async (row) => {
          try {
            const bal = await fetchNativeBalance(row.address, activeNetwork);
            row.balance = bal;
            row.balanceNum = parseFloat(bal) || 0;
          } catch (e) {
            // keep old
          }
        })
      );
    }
    setSendQueue([...updated]);
    setIsLoadingBalances(false);
    onNotify?.('Saldo berhasil diperbarui!', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          background: 'radial-gradient(ellipse at top left, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.08) 50%, rgba(18, 24, 38, 0.9) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.25)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Bulk Sweeper & Collector
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Jaringan: <strong style={{ color: activeNetwork.color || '#fff' }}>{activeNetwork.name} ({activeNetwork.symbol})</strong>
              </span>
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
              Kirim Bulk ke 1 Address (Konsolidasi Saldo)
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '680px' }}>
              Import semua Private Key, pantau saldo {activeNetwork.symbol} masing-masing akun, dan kirimkan semua aset ke 1 alamat tujuan penampung dalam 1 kali klik. Biaya gas ditanggung langsung oleh masing-masing dompet.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ganti Jaringan:</span>
            <select
              value={selectedNetworkId}
              onChange={(e) => setSelectedNetworkId(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 600
              }}
            >
              {networks.map((net) => (
                <option key={net.id} value={net.id} style={{ background: '#121826', color: '#fff' }}>
                  {net.name} ({net.symbol})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Step 1: Input Private Keys */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <KeyRound size={18} color="#06b6d4" />
            <span>Langkah 1: Import Private Key Pengirim</span>
          </h3>

          <div style={{ display: 'flex', gap: '8px' }}>
            {storedWallets.length > 0 && (
              <button
                type="button"
                onClick={handleLoadFromStoredWallets}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                title="Gunakan semua akun yang sudah tersimpan di aplikasi"
              >
                <Wallet size={14} color="#6366f1" />
                <span>Gunakan Wallet Aplikasi ({storedWallets.filter((w) => w.privateKey).length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleLoadPrivateKeys(rawPrivateKeys)}
              disabled={isLoadingBalances}
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              {isLoadingBalances ? <RefreshCw className="spin" size={14} /> : <Zap size={14} />}
              <span>Muat & Cek Saldo</span>
            </button>
          </div>
        </div>

        <textarea
          rows={4}
          value={rawPrivateKeys}
          onChange={(e) => setRawPrivateKeys(e.target.value)}
          placeholder="Tempel daftar Private Key di sini (1 per baris, contoh: 0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d)..."
          style={{
            width: '100%',
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '12px',
            color: '#fff',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            lineHeight: 1.4
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            * Private key diproses murni di sisi browser (klien) dan tidak dikirimkan ke server mana pun.
          </span>
          <span style={{ fontSize: '0.8rem', color: sendQueue.length > 0 ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
            {sendQueue.length} Wallet Terdeteksi
          </span>
        </div>
      </div>

      {/* Step 2: Target Recipient & Quick Amount Setup */}
      {sendQueue.length > 0 && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowRight size={18} color="#10b981" />
            <span>Langkah 2: Tentukan Alamat Penerima & Nominal Kirim</span>
          </h3>

          {/* KIRIM KE (RECIPIENT) FORM - EXACT USER REQUEST LAYOUT */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: `1.5px solid ${isRecipientValid ? '#10b981' : 'var(--border-color)'}`,
              borderRadius: '14px',
              padding: '16px',
              marginBottom: '20px',
              boxShadow: isRecipientValid ? '0 0 15px rgba(16, 185, 129, 0.15)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
              Kirim ke :
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value.trim())}
                  placeholder="0x... Masukkan alamat EVM penampung tujuan"
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handlePasteRecipient}
                className="btn btn-secondary"
                style={{ padding: '12px 16px', fontSize: '0.85rem' }}
                title="Tempel dari Clipboard"
              >
                <ClipboardPaste size={16} />
                <span>Tempel</span>
              </button>
            </div>

            {recipientAddress && !isRecipientValid && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#f43f5e', marginTop: '6px' }}>
                <AlertCircle size={14} /> Alamat tidak valid (harus 42 karakter dan diawali 0x)
              </span>
            )}
            {isRecipientValid && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: '#10b981', marginTop: '6px' }}>
                <CheckCircle2 size={14} /> Alamat tujuan valid & siap menerima dana
              </span>
            )}
          </div>

          {/* Quick Amount Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '14px 18px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              marginBottom: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Pengisian Cepat:
              </span>
              <button
                type="button"
                onClick={handleApplyMaxToAll}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
                  border: '1px solid #10b981',
                  color: '#10b981',
                  padding: '7px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 700
                }}
                title="Otomatis mengisi (Saldo - Gas Fee) untuk semua wallet"
              >
                <Flame size={15} />
                <span>Kirim Semua / Max (Saldo - Gas Fee)</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                step="any"
                min="0"
                value={uniformAmount}
                onChange={(e) => setUniformAmount(e.target.value)}
                placeholder={`Nominal ${activeNetwork.symbol}...`}
                style={{
                  width: '130px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  color: '#fff',
                  fontSize: '0.82rem'
                }}
              />
              <button
                type="button"
                onClick={handleApplyUniformAmount}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                Terapkan ke Semua
              </button>
            </div>
          </div>

          {/* TABLE OF WALLETS - USER SPECIFIED FORMAT: | Adress | Balance | (form Nominal) | */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px', marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 14px', width: '45px' }}>#</th>
                  <th style={{ padding: '12px 14px' }}>Address (Pengirim)</th>
                  <th style={{ padding: '12px 14px' }}>Balance ({activeNetwork.symbol})</th>
                  <th style={{ padding: '12px 14px', minWidth: '220px' }}>Nominal Yang Akan Dikirim</th>
                  <th style={{ padding: '12px 14px' }}>Status Pengiriman</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right', width: '50px' }}>Hapus</th>
                </tr>
              </thead>
              <tbody>
                {sendQueue.map((row, idx) => {
                  const hasBal = (row.balanceNum || 0) > 0;
                  const hasAmount = parseFloat(row.amountToSend) > 0;
                  return (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        background:
                          row.status === 'success'
                            ? 'rgba(16, 185, 129, 0.06)'
                            : row.status === 'error'
                            ? 'rgba(244, 63, 94, 0.06)'
                            : 'transparent'
                      }}
                    >
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {idx + 1}
                      </td>

                      {/* Column 1: Address */}
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600 }}>{formatAddress(row.address, 6, 4)}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(row.address, `addr_${idx}`)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedId === `addr_${idx}` ? '#10b981' : 'var(--text-muted)' }}
                            title="Salin Alamat Lengkap"
                          >
                            {copiedId === `addr_${idx}` ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                          {activeNetwork.explorerUrl && (
                            <a
                              href={`${activeNetwork.explorerUrl}/address/${row.address}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                              title="Buka di Explorer"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Column 2: Balance */}
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ fontWeight: 700, color: hasBal ? '#10b981' : 'var(--text-muted)' }}>
                          {row.balance} {activeNetwork.symbol}
                        </span>
                      </td>

                      {/* Column 3: Form Nominal Yang Akan Dikirim */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            value={row.amountToSend}
                            onChange={(e) => handleRowAmountChange(row.id, e.target.value)}
                            placeholder="0.0"
                            disabled={isSendingBulk}
                            style={{
                              width: '130px',
                              background: 'rgba(0, 0, 0, 0.35)',
                              border: `1px solid ${hasAmount ? '#6366f1' : 'var(--border-color)'}`,
                              borderRadius: '8px',
                              padding: '6px 10px',
                              color: '#fff',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.82rem'
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSetRowMax(row.id)}
                            disabled={isSendingBulk || !hasBal}
                            className="btn btn-secondary"
                            style={{ padding: '5px 8px', fontSize: '0.72rem', fontWeight: 700 }}
                            title="Kirim Saldo Maksimal (dipotong gas fee)"
                          >
                            Max
                          </button>
                        </div>
                      </td>

                      {/* Column 4: Status */}
                      <td style={{ padding: '12px 14px' }}>
                        {row.status === 'idle' && (
                          <span style={{ color: hasAmount ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: '0.78rem' }}>
                            {hasAmount ? 'Siap Dikirim' : 'Nominal Kosong'}
                          </span>
                        )}
                        {row.status === 'sending' && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#06b6d4', fontSize: '0.78rem', fontWeight: 600 }}>
                            <RefreshCw className="spin" size={13} /> Mengirim TX...
                          </span>
                        )}
                        {row.status === 'success' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: '#10b981', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle2 size={13} /> Sukses
                            </span>
                            {row.txHash && activeNetwork.explorerUrl && (
                              <a
                                href={`${activeNetwork.explorerUrl}/tx/${row.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: '#6366f1', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '2px', textDecoration: 'underline' }}
                                title="Lihat Bukti TX di Explorer"
                              >
                                {row.txHash.substring(0, 8)}... <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        )}
                        {row.status === 'error' && (
                          <span style={{ color: '#f43f5e', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }} title={row.errorMsg}>
                            <AlertCircle size={13} /> {row.errorMsg?.substring(0, 24)}...
                          </span>
                        )}
                      </td>

                      {/* Column 5: Action Delete */}
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          disabled={isSendingBulk}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          title="Hapus baris ini"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Execution Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              padding: '18px 22px',
              background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.1) 0%, rgba(18, 24, 38, 0.95) 100%)',
              borderRadius: '16px',
              border: '1px solid rgba(99, 102, 241, 0.25)'
            }}
          >
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                Total Dana Yang Akan Terkumpul:
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
                {totalAmountToSend.toFixed(5)} {activeNetwork.symbol}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Dari <strong>{totalWalletsWithAmount}</strong> dompet pengirim &bull; Estimasi gas per transaksi ~{estimatedGasFeePerTx} {activeNetwork.symbol} (dipotong dari saldo masing-masing)
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleRefreshAllBalances}
                disabled={isLoadingBalances || isSendingBulk}
                className="btn btn-secondary"
                style={{ padding: '12px 16px', fontSize: '0.85rem' }}
                title="Perbarui Saldo Terkini"
              >
                <RefreshCw className={isLoadingBalances ? 'spin' : ''} size={16} />
                <span>Refresh Saldo</span>
              </button>

              <button
                type="button"
                onClick={handleExecuteBulkSend}
                disabled={isSendingBulk || totalWalletsWithAmount === 0 || !isRecipientValid}
                className="btn btn-primary"
                style={{
                  padding: '12px 28px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  boxShadow: '0 4px 18px rgba(16, 185, 129, 0.4)'
                }}
              >
                {isSendingBulk ? <RefreshCw className="spin" size={18} /> : <Send size={18} />}
                <span>
                  {isSendingBulk
                    ? `Mengirim ${sendProgress.current} dari ${sendProgress.total}...`
                    : `Kirim Bulk ke 1 Address (${totalWalletsWithAmount} Wallet)`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
