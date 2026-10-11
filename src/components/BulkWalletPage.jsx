import React, { useState, useMemo } from 'react';
import {
  Layers,
  Sparkles,
  Download,
  Copy,
  Check,
  Eye,
  EyeOff,
  Search,
  ExternalLink,
  Save,
  RefreshCw,
  Coins,
  FileText,
  ShieldAlert,
  Filter,
  CheckCircle2,
  KeyRound,
  FileSpreadsheet,
  UploadCloud,
  Send
} from 'lucide-react';
import { BulkSendToOne } from './BulkSendToOne';
import { bulkGenerateWallets, parseBulkInput, formatAddress } from '../services/wallet';
import { fetchNativeBalance } from '../services/blockscout';
import { fetchTokenBalance } from '../services/tokens';
import { DEFAULT_TOKENS } from '../constants/networks';

export const BulkWalletPage = ({
  network,
  networks = [],
  wallets = [],
  initialSubTab = 'generator',
  onAddWalletsBatch,
  onSelectWallet,
  onNotify,
  onOpenNetworkModal
}) => {
  // Navigation Sub-tabs: 'generator', 'sweep', 'checker', 'importer'
  const [activeSubTab, setActiveSubTab] = useState(initialSubTab || 'generator');

  React.useEffect(() => {
    if (initialSubTab) setActiveSubTab(initialSubTab);
  }, [initialSubTab]);

  // ==========================================
  // TAB 1: BULK GENERATOR STATE
  // ==========================================
  const [generateMode, setGenerateMode] = useState('hd'); // 'hd' or 'random'
  const [walletCount, setWalletCount] = useState(10);
  const [walletPrefix, setWalletPrefix] = useState('Bulk Account');
  const [customMnemonic, setCustomMnemonic] = useState('');
  const [useCustomMnemonic, setUseCustomMnemonic] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generated results
  const [generatedBatch, setGeneratedBatch] = useState(null);
  const [revealedKeys, setRevealedKeys] = useState({}); // { [index]: boolean }
  const [revealedPhrases, setRevealedPhrases] = useState({}); // { [index]: boolean }
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // ==========================================
  // TAB 2: BULK BALANCE CHECKER STATE
  // ==========================================
  const [checkerSource, setCheckerSource] = useState('generated'); // 'generated', 'stored', 'manual'
  const [manualAddressesText, setManualAddressesText] = useState('');
  const [selectedCheckerNetworkId, setSelectedCheckerNetworkId] = useState(network.id);
  const [isCheckingBalances, setIsCheckingBalances] = useState(false);
  const [checkProgress, setCheckProgress] = useState({ current: 0, total: 0 });
  const [balanceResults, setBalanceResults] = useState([]);
  const [filterOnlyNonZero, setFilterOnlyNonZero] = useState(false);

  // ==========================================
  // TAB 3: BULK IMPORTER STATE
  // ==========================================
  const [importRawText, setImportRawText] = useState('');
  const [importPrefix, setImportPrefix] = useState('Akun Impor');

  // Active network for checking
  const activeCheckerNetwork = useMemo(() => {
    return networks.find((n) => n.id === selectedCheckerNetworkId) || network;
  }, [networks, selectedCheckerNetworkId, network]);

  // Utility to handle copy
  const handleCopy = (text, id, message = 'Berhasil disalin!') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    onNotify?.(message, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle reveal private key for a single row
  const toggleRevealKey = (idx) => {
    setRevealedKeys((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Toggle reveal mnemonic phrase for a single row (when mode is random)
  const toggleRevealPhrase = (idx) => {
    setRevealedPhrases((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // ==========================================
  // HANDLERS: GENERATOR
  // ==========================================
  const handleGenerate = () => {
    setIsGenerating(true);
    try {
      const result = bulkGenerateWallets(walletCount, generateMode, {
        prefix: walletPrefix,
        customMnemonic: useCustomMnemonic ? customMnemonic : null
      });
      setGeneratedBatch(result);
      setRevealedKeys({});
      setRevealedPhrases({});
      setShowSeedPhrase(false);
      onNotify?.(`Sukses membuat ${result.wallets.length} wallet baru!`, 'success');
    } catch (err) {
      onNotify?.(`Gagal generate: ${err.message}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save all generated wallets to the app storage
  const handleSaveAllToApp = () => {
    if (!generatedBatch || generatedBatch.wallets.length === 0) return;
    onAddWalletsBatch(generatedBatch.wallets);
    onNotify?.(`${generatedBatch.wallets.length} wallet berhasil disimpan ke aplikasi!`, 'success');
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!generatedBatch || generatedBatch.wallets.length === 0) return;
    const headers = ['Index', 'Name', 'Address', 'PrivateKey', 'DerivationPath', 'MnemonicPhrase'];
    const rows = generatedBatch.wallets.map((w, i) => [
      i + 1,
      `"${w.name}"`,
      w.address,
      w.privateKey,
      w.path || '',
      `"${w.mnemonic || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bulk_wallets_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify?.('File CSV berhasil diunduh!', 'success');
  };

  // Export JSON
  const handleExportJSON = () => {
    if (!generatedBatch || generatedBatch.wallets.length === 0) return;
    const jsonStr = JSON.stringify(generatedBatch, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bulk_wallets_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    onNotify?.('File JSON berhasil diunduh!', 'success');
  };

  // Copy All as Formatted Text (Address, PK, Mnemonic if available)
  const handleCopyAllText = () => {
    if (!generatedBatch || generatedBatch.wallets.length === 0) return;
    const textLines = generatedBatch.wallets.map((w) => {
      if (w.mnemonic) {
        return `${w.address},${w.privateKey},${w.mnemonic}`;
      }
      return `${w.address},${w.privateKey}`;
    }).join('\n');
    handleCopy(textLines, 'copy_all_text', 'Daftar alamat, private key, dan seed phrase disalin!');
  };

  // Filtered generated list
  const filteredGeneratedWallets = useMemo(() => {
    if (!generatedBatch) return [];
    if (!searchFilter.trim()) return generatedBatch.wallets;
    const q = searchFilter.toLowerCase();
    return generatedBatch.wallets.filter(
      (w) =>
        w.address.toLowerCase().includes(q) ||
        w.name.toLowerCase().includes(q) ||
        String(w.index + 1).includes(q)
    );
  }, [generatedBatch, searchFilter]);

  // ==========================================
  // HANDLERS: BALANCE CHECKER
  // ==========================================
  // Find USDT token config for the active checker network
  const activeUsdtToken = useMemo(() => {
    const networkTokens = DEFAULT_TOKENS[activeCheckerNetwork.id] || [];
    return networkTokens.find((t) => t.symbol === 'USDT') || null;
  }, [activeCheckerNetwork]);

  const handleStartBalanceCheck = async () => {
    let targetAddresses = [];

    if (checkerSource === 'generated') {
      if (!generatedBatch || generatedBatch.wallets.length === 0) {
        onNotify?.('Belum ada wallet yang dibuat. Buat di tab Generator terlebih dahulu.', 'warning');
        return;
      }
      targetAddresses = generatedBatch.wallets.map((w) => ({
        name: w.name,
        address: w.address,
        privateKey: w.privateKey
      }));
    } else if (checkerSource === 'stored') {
      if (!wallets || wallets.length === 0) {
        onNotify?.('Tidak ada wallet tersimpan di aplikasi.', 'warning');
        return;
      }
      targetAddresses = wallets.map((w) => ({
        name: w.name,
        address: w.address,
        privateKey: w.privateKey
      }));
    } else {
      // Manual input
      const lines = manualAddressesText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const parsed = parseBulkInput(lines.join('\n'), 'Alamat');
      if (parsed.length === 0) {
        onNotify?.('Tidak ada alamat atau private key yang valid dalam input.', 'error');
        return;
      }
      targetAddresses = parsed.map((p) => ({
        name: p.name,
        address: p.address,
        privateKey: p.privateKey
      }));
    }

    setIsCheckingBalances(true);
    setCheckProgress({ current: 0, total: targetAddresses.length });
    const results = [];

    // Process concurrently in chunks of 4 to avoid RPC rate limit
    const chunkSize = 4;
    for (let i = 0; i < targetAddresses.length; i += chunkSize) {
      const chunk = targetAddresses.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(async (item) => {
        try {
          // Fetch native balance (MTT)
          const nativeBal = await fetchNativeBalance(item.address, activeCheckerNetwork);

          // Fetch USDT balance if USDT token exists on this network
          let usdtBal = '0.0000';
          let usdtBalNum = 0;
          if (activeUsdtToken) {
            try {
              usdtBal = await fetchTokenBalance(
                activeUsdtToken.address,
                item.address,
                activeUsdtToken.decimals,
                activeCheckerNetwork
              );
              usdtBalNum = parseFloat(usdtBal) || 0;
            } catch (_) {
              usdtBal = '0.0000';
              usdtBalNum = 0;
            }
          }

          return {
            ...item,
            balance: nativeBal,
            balanceNum: parseFloat(nativeBal) || 0,
            usdtBalance: usdtBal,
            usdtBalanceNum: usdtBalNum,
            status: 'ok'
          };
        } catch (e) {
          return {
            ...item,
            balance: '0.0000',
            balanceNum: 0,
            usdtBalance: '0.0000',
            usdtBalanceNum: 0,
            status: 'error'
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
      setCheckProgress({ current: Math.min(i + chunkSize, targetAddresses.length), total: targetAddresses.length });
    }

    setBalanceResults(results);
    setIsCheckingBalances(false);
    onNotify?.(`Pengecekan ${results.length} wallet selesai (${activeCheckerNetwork.symbol}${activeUsdtToken ? ' + USDT' : ''})!`, 'success');
  };

  // Export Checked Balances CSV
  const handleExportBalancesCSV = () => {
    if (balanceResults.length === 0) return;
    const headers = ['Name', 'Address', `Balance (${activeCheckerNetwork.symbol})`, activeUsdtToken ? 'Balance (USDT)' : null, 'Status'].filter(Boolean);
    const rows = balanceResults.map((b) => {
      const row = [`"${b.name}"`, b.address, b.balance];
      if (activeUsdtToken) row.push(b.usdtBalance || '0.0000');
      row.push(b.status);
      return row;
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `wallet_balances_${activeCheckerNetwork.symbol}_${Date.now()}.csv`;
    link.click();
    onNotify?.('Data saldo berhasil diunduh dalam format CSV!', 'success');
  };

  // Stats for checker
  const totalCheckedBalance = useMemo(() => {
    return balanceResults.reduce((acc, curr) => acc + (curr.balanceNum || 0), 0);
  }, [balanceResults]);

  const totalCheckedUsdtBalance = useMemo(() => {
    return balanceResults.reduce((acc, curr) => acc + (curr.usdtBalanceNum || 0), 0);
  }, [balanceResults]);

  const nonZeroCount = useMemo(() => {
    return balanceResults.filter((b) => (b.balanceNum || 0) > 0 || (b.usdtBalanceNum || 0) > 0).length;
  }, [balanceResults]);

  const displayedBalanceResults = useMemo(() => {
    if (!filterOnlyNonZero) return balanceResults;
    return balanceResults.filter((b) => (b.balanceNum || 0) > 0 || (b.usdtBalanceNum || 0) > 0);
  }, [balanceResults, filterOnlyNonZero]);

  // ==========================================
  // HANDLERS: IMPORTER
  // ==========================================
  const parsedImportPreview = useMemo(() => {
    return parseBulkInput(importRawText, importPrefix);
  }, [importRawText, importPrefix]);

  const handleExecuteImport = () => {
    if (parsedImportPreview.length === 0) {
      onNotify?.('Tidak ada data wallet valid yang terdeteksi untuk diimpor.', 'error');
      return;
    }

    onAddWalletsBatch(parsedImportPreview);
    onNotify?.(`Berhasil mengimpor ${parsedImportPreview.length} wallet ke aplikasi!`, 'success');
    setImportRawText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner / Heading */}
      <div
        className="glass-panel"
        style={{
          padding: '24px',
          background: 'radial-gradient(ellipse at top right, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.05) 50%, rgba(18, 24, 38, 0.9) 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Tools EVM
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Jaringan Aktif: <strong style={{ color: network.color || '#fff' }}>{network.name}</strong>
              </span>
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
              Bulk Wallet Generator & Tools
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '600px' }}>
              Buat puluhan hingga ratusan alamat EVM sekaligus dengan cepat, periksa saldo secara massal, atau impor data akun dengan mudah.
            </p>
          </div>

          {/* Sub-tabs Selector */}
          <div
            style={{
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '5px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              gap: '4px'
            }}
          >
            <button
              onClick={() => setActiveSubTab('generator')}
              className={`btn ${activeSubTab === 'generator' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <Sparkles size={16} />
              <span>Generator</span>
            </button>
            <button
              onClick={() => setActiveSubTab('sweep')}
              className={`btn ${activeSubTab === 'sweep' ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                padding: '8px 14px',
                fontSize: '0.85rem',
                border: activeSubTab === 'sweep' ? '1px solid #10b981' : 'transparent',
                background: activeSubTab === 'sweep' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent'
              }}
            >
              <Send size={16} />
              <span>Kirim Bulk ke 1 Address</span>
            </button>
            <button
              onClick={() => setActiveSubTab('checker')}
              className={`btn ${activeSubTab === 'checker' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <Coins size={16} />
              <span>Cek Saldo Massal</span>
            </button>
            <button
              onClick={() => setActiveSubTab('importer')}
              className={`btn ${activeSubTab === 'importer' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '8px 14px', fontSize: '0.85rem' }}
            >
              <UploadCloud size={16} />
              <span>Impor Massal</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB: BULK SEND TO ONE RECIPIENT (COLLECTOR / SWEEPER) */}
      {/* ========================================================================= */}
      {activeSubTab === 'sweep' && (
        <BulkSendToOne
          network={network}
          networks={networks}
          storedWallets={wallets}
          onNotify={onNotify}
          onOpenNetworkModal={onOpenNetworkModal}
        />
      )}

      {/* ========================================================================= */}
      {/* TAB 1: BULK GENERATOR */}
      {/* ========================================================================= */}
      {activeSubTab === 'generator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Controls Box */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="#6366f1" />
              <span>Konfigurasi Pembuatan Wallet</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              {/* Mode Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                  Metode Pembuatan
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setGenerateMode('hd')}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: `1px solid ${generateMode === 'hd' ? '#6366f1' : 'var(--border-color)'}`,
                      background: generateMode === 'hd' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: generateMode === 'hd' ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>1 Master Seed Phrase (BIP-44)</span>
                    <span style={{ fontSize: '0.7rem', color: '#10b981' }}>1 Phrase untuk Semua Akun</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenerateMode('random')}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: `1px solid ${generateMode === 'random' ? '#06b6d4' : 'var(--border-color)'}`,
                      background: generateMode === 'random' ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: generateMode === 'random' ? '#ffffff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>Phrase Terpisah per Address</span>
                    <span style={{ fontSize: '0.7rem', color: '#06b6d4' }}>Tiap Akun Punya 12 Kata Sendiri</span>
                  </button>
                </div>
              </div>

              {/* Number of Wallets */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                  Jumlah Wallet ({walletCount})
                </label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {[5, 10, 20, 50, 100].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setWalletCount(num)}
                      className="btn"
                      style={{
                        padding: '6px 10px',
                        fontSize: '0.8rem',
                        background: walletCount === num ? '#6366f1' : 'rgba(255, 255, 255, 0.05)',
                        borderColor: walletCount === num ? '#6366f1' : 'var(--border-color)',
                        color: '#fff'
                      }}
                    >
                      {num}
                    </button>
                  ))}
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={walletCount}
                    onChange={(e) => setWalletCount(Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))}
                    style={{
                      width: '70px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      textAlign: 'center'
                    }}
                  />
                </div>
              </div>

              {/* Prefix Name */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                  Awalan Nama Akun
                </label>
                <input
                  type="text"
                  value={walletPrefix}
                  onChange={(e) => setWalletPrefix(e.target.value)}
                  placeholder="Contoh: Airdrop, Bot, MTT"
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            {/* Optional Custom Mnemonic if HD */}
            {generateMode === 'hd' && (
              <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: useCustomMnemonic ? '10px' : '0' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={useCustomMnemonic}
                      onChange={(e) => setUseCustomMnemonic(e.target.checked)}
                      style={{ cursor: 'pointer', accentColor: '#6366f1' }}
                    />
                    <span>Gunakan Seed Phrase yang Sudah Ada (Derivasi akun dari mnemonic sendiri)</span>
                  </label>
                </div>
                {useCustomMnemonic && (
                  <input
                    type="text"
                    value={customMnemonic}
                    onChange={(e) => setCustomMnemonic(e.target.value)}
                    placeholder="Masukkan 12 atau 24 kata seed phrase dipisahkan spasi..."
                    style={{
                      width: '100%',
                      background: 'rgba(0, 0, 0, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                )}
              </div>
            )}

            {/* Generate Action Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="btn btn-primary"
                style={{ padding: '12px 28px', fontSize: '0.95rem', minWidth: '220px' }}
              >
                {isGenerating ? <RefreshCw className="spin" size={18} /> : <Sparkles size={18} />}
                <span>Generate {walletCount} Wallet Sekarang</span>
              </button>
            </div>
          </div>

          {/* Generated Result Container */}
          {generatedBatch && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              {/* Header result & quick action bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={20} color="#10b981" />
                    <span>{generatedBatch.wallets.length} Wallet Berhasil Dibuat</span>
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Mode: {generatedBatch.mode === 'hd' ? 'BIP-44 HD Derivation' : 'Random Independent Private Keys'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <button
                    onClick={handleExportCSV}
                    className="btn btn-secondary"
                    style={{ padding: '7px 12px', fontSize: '0.82rem' }}
                    title="Unduh format spreadsheet CSV"
                  >
                    <FileSpreadsheet size={15} color="#10b981" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={handleExportJSON}
                    className="btn btn-secondary"
                    style={{ padding: '7px 12px', fontSize: '0.82rem' }}
                    title="Unduh format JSON"
                  >
                    <FileText size={15} color="#06b6d4" />
                    <span>Export JSON</span>
                  </button>

                  <button
                    onClick={handleCopyAllText}
                    className="btn btn-secondary"
                    style={{ padding: '7px 12px', fontSize: '0.82rem' }}
                    title="Salin semua Address & Private Key"
                  >
                    {copiedId === 'copy_all_text' ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
                    <span>Salin Semua (TXT)</span>
                  </button>

                  <button
                    onClick={handleSaveAllToApp}
                    className="btn btn-primary"
                    style={{ padding: '7px 14px', fontSize: '0.82rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                    title="Tambahkan semua wallet ini ke daftar aplikasi lokal"
                  >
                    <Save size={15} />
                    <span>Simpan ke Aplikasi</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveSubTab('checker');
                      setCheckerSource('generated');
                    }}
                    className="btn btn-secondary"
                    style={{ padding: '7px 12px', fontSize: '0.82rem' }}
                    title="Pindah ke cek saldo"
                  >
                    <Coins size={15} color="#f59e0b" />
                    <span>Cek Saldo</span>
                  </button>
                </div>
              </div>

              {/* Master Mnemonic Card (if HD mode) */}
              {generatedBatch.mnemonic && (
                <div
                  style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '14px',
                    padding: '16px',
                    marginBottom: '20px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <KeyRound size={18} color="#6366f1" />
                      <strong style={{ fontSize: '0.9rem', color: '#c7d2fe' }}>Master Seed Phrase (BIP-39)</strong>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(99, 102, 241, 0.2)', padding: '2px 8px', borderRadius: '10px' }}>
                        1 Phrase untuk Semua {generatedBatch.wallets.length} Akun
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setShowSeedPhrase(!showSeedPhrase)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.8rem'
                        }}
                      >
                        {showSeedPhrase ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>{showSeedPhrase ? 'Sembunyikan' : 'Tampilkan'}</span>
                      </button>
                      <button
                        onClick={() => handleCopy(generatedBatch.mnemonic, 'master_mnemonic', 'Seed phrase disalin!')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: copiedId === 'master_mnemonic' ? '#10b981' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.8rem'
                        }}
                      >
                        {copiedId === 'master_mnemonic' ? <Check size={14} /> : <Copy size={14} />}
                        <span>Salin Phrase</span>
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      padding: '12px 14px',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      letterSpacing: '0.02em',
                      color: showSeedPhrase ? '#ffffff' : '#64748b',
                      userSelect: showSeedPhrase ? 'all' : 'none',
                      filter: showSeedPhrase ? 'none' : 'blur(4px)',
                      transition: 'filter 0.2s ease'
                    }}
                  >
                    {generatedBatch.mnemonic}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldAlert size={14} />
                    Simpan seed phrase ini di tempat yang sangat aman. Siapa pun yang memiliki frasa ini dapat mengakses seluruh {generatedBatch.wallets.length} wallet di atas.
                  </p>
                </div>
              )}

              {/* Search filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Cari berdasarkan nomor akun atau alamat (0x...)..."
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      padding: '8px 12px 8px 36px',
                      color: '#fff',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Menampilkan {filteredGeneratedWallets.length} dari {generatedBatch.wallets.length}
                </span>
              </div>

              {/* Table of Generated Wallets */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '10px 14px', width: '50px' }}>#</th>
                      <th style={{ padding: '10px 14px' }}>Nama Akun</th>
                      <th style={{ padding: '10px 14px' }}>Address</th>
                      <th style={{ padding: '10px 14px' }}>Private Key</th>
                      {generatedBatch.mode === 'random' && <th style={{ padding: '10px 14px' }}>Seed Phrase (12 Kata)</th>}
                      {generatedBatch.mode === 'hd' && <th style={{ padding: '10px 14px' }}>Path</th>}
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGeneratedWallets.map((w, idx) => {
                      const isRevealed = revealedKeys[w.index];
                      const isPhraseRevealed = revealedPhrases[w.index];
                      return (
                        <tr
                          key={w.id || idx}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {w.index + 1}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{w.name}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{formatAddress(w.address, 8, 6)}</span>
                              <button
                                onClick={() => handleCopy(w.address, `addr_${w.index}`, 'Alamat disalin!')}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedId === `addr_${w.index}` ? '#10b981' : 'var(--text-muted)' }}
                                title="Salin Alamat Lengkap"
                              >
                                {copiedId === `addr_${w.index}` ? <Check size={13} /> : <Copy size={13} />}
                              </button>
                              {network.explorerUrl && (
                                <a
                                  href={`${network.explorerUrl}/address/${w.address}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                                  title="Lihat di Block Explorer"
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{isRevealed ? `${w.privateKey.substring(0, 10)}...${w.privateKey.substring(60)}` : '••••••••••••••••••••'}</span>
                              <button
                                onClick={() => toggleRevealKey(w.index)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                                title={isRevealed ? 'Sembunyikan' : 'Tampilkan'}
                              >
                                {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                              <button
                                onClick={() => handleCopy(w.privateKey, `pk_${w.index}`, 'Private key disalin!')}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedId === `pk_${w.index}` ? '#10b981' : 'var(--text-muted)' }}
                                title="Salin Private Key"
                              >
                                {copiedId === `pk_${w.index}` ? <Check size={13} /> : <Copy size={13} />}
                              </button>
                            </div>
                          </td>
                          {generatedBatch.mode === 'random' && (
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.78rem' }}>
                                  {isPhraseRevealed ? w.mnemonic : '•••• •••• •••• ••••'}
                                </span>
                                <button
                                  onClick={() => toggleRevealPhrase(w.index)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                                  title={isPhraseRevealed ? 'Sembunyikan' : 'Tampilkan'}
                                >
                                  {isPhraseRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                                <button
                                  onClick={() => handleCopy(w.mnemonic, `phrase_${w.index}`, 'Seed phrase disalin!')}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedId === `phrase_${w.index}` ? '#10b981' : 'var(--text-muted)' }}
                                  title="Salin Seed Phrase"
                                >
                                  {copiedId === `phrase_${w.index}` ? <Check size={13} /> : <Copy size={13} />}
                                </button>
                              </div>
                            </td>
                          )}
                          {generatedBatch.mode === 'hd' && (
                            <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                              {w.path}
                            </td>
                          )}
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                onAddWalletsBatch([w]);
                                onSelectWallet(w);
                                onNotify?.(`${w.name} sekarang aktif!`, 'success');
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            >
                              Gunakan
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BULK BALANCE CHECKER */}
      {/* ========================================================================= */}
      {activeSubTab === 'checker' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Coins size={18} color="#f59e0b" />
              <span>Pemeriksa Saldo Massal (Multi-Wallet Balance)</span>
            </h3>

            {/* Source and network selection */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              {/* Source */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                  Pilih Sumber Alamat
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setCheckerSource('generated')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: `1px solid ${checkerSource === 'generated' ? '#6366f1' : 'var(--border-color)'}`,
                      background: checkerSource === 'generated' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: checkerSource === 'generated' ? '#fff' : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Hasil Generator ({generatedBatch ? generatedBatch.wallets.length : 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckerSource('stored')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: `1px solid ${checkerSource === 'stored' ? '#6366f1' : 'var(--border-color)'}`,
                      background: checkerSource === 'stored' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: checkerSource === 'stored' ? '#fff' : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Wallet Aplikasi ({wallets.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckerSource('manual')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      border: `1px solid ${checkerSource === 'manual' ? '#6366f1' : 'var(--border-color)'}`,
                      background: checkerSource === 'manual' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                      color: checkerSource === 'manual' ? '#fff' : 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Input Manual
                  </button>
                </div>
              </div>

              {/* Target Network */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
                  Jaringan Pengecekan
                </label>
                <select
                  value={selectedCheckerNetworkId}
                  onChange={(e) => setSelectedCheckerNetworkId(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '9px 12px',
                    color: '#fff',
                    fontSize: '0.85rem'
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

            {/* If manual source */}
            {checkerSource === 'manual' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                  Tempel Daftar Alamat (1 baris per alamat):
                </label>
                <textarea
                  rows={5}
                  value={manualAddressesText}
                  onChange={(e) => setManualAddressesText(e.target.value)}
                  placeholder="0x1234567890123456789012345678901234567890&#10;0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '12px',
                    color: '#fff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.82rem'
                  }}
                />
              </div>
            )}

            {/* Check Button & Progress */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Target Token: <strong style={{ color: activeCheckerNetwork.color || '#fff' }}>{activeCheckerNetwork.symbol}</strong>{activeUsdtToken ? <> + <strong style={{ color: '#26a17b' }}>USDT</strong></> : null} via RPC {activeCheckerNetwork.name}
              </div>

              <button
                type="button"
                onClick={handleStartBalanceCheck}
                disabled={isCheckingBalances}
                className="btn btn-primary"
                style={{ padding: '10px 24px', fontSize: '0.9rem' }}
              >
                {isCheckingBalances ? <RefreshCw className="spin" size={16} /> : <Coins size={16} />}
                <span>{isCheckingBalances ? `Memeriksa ${checkProgress.current}/${checkProgress.total}...` : 'Mulai Pengecekan Saldo'}</span>
              </button>
            </div>

            {/* Progress Bar */}
            {isCheckingBalances && checkProgress.total > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ height: '6px', width: '100%', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(checkProgress.current / checkProgress.total) * 100}%`,
                      background: 'linear-gradient(90deg, #6366f1 0%, #10b981 100%)',
                      transition: 'width 0.2s ease'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Balance Results Table */}
          {balanceResults.length > 0 && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total {activeCheckerNetwork.symbol}</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                    {totalCheckedBalance.toFixed(4)} {activeCheckerNetwork.symbol}
                  </div>
                </div>

                {activeUsdtToken && (
                  <div style={{ background: 'rgba(38, 161, 123, 0.05)', border: '1px solid rgba(38, 161, 123, 0.25)', borderRadius: '12px', padding: '14px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total USDT ({activeCheckerNetwork.shortName || activeCheckerNetwork.name})</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#26a17b', marginTop: '4px' }}>
                      {totalCheckedUsdtBalance.toFixed(4)} USDT
                    </div>
                  </div>
                )}

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Wallet Bersaldo (&gt; 0)</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#6366f1', marginTop: '4px' }}>
                    {nonZeroCount} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {balanceResults.length}</span>
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '14px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jaringan</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginTop: '4px' }}>
                    {activeCheckerNetwork.shortName || activeCheckerNetwork.name}
                  </div>
                </div>
              </div>

              {/* Action and Filter Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setFilterOnlyNonZero(!filterOnlyNonZero)}
                    className="btn btn-secondary"
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      background: filterOnlyNonZero ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      borderColor: filterOnlyNonZero ? '#10b981' : 'var(--border-color)',
                      color: filterOnlyNonZero ? '#10b981' : 'var(--text-primary)'
                    }}
                  >
                    <Filter size={14} />
                    <span>Hanya Saldo &gt; 0 ({nonZeroCount})</span>
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleExportBalancesCSV}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    <Download size={14} />
                    <span>Export CSV Saldo</span>
                  </button>
                  <button
                    onClick={handleStartBalanceCheck}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    title="Refresh ulang saldo"
                  >
                    <RefreshCw size={14} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Results Table */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '10px 14px', width: '50px' }}>#</th>
                      <th style={{ padding: '10px 14px' }}>Nama</th>
                      <th style={{ padding: '10px 14px' }}>Address</th>
                      <th style={{ padding: '10px 14px' }}>Saldo ({activeCheckerNetwork.symbol})</th>
                      {activeUsdtToken && <th style={{ padding: '10px 14px' }}>Saldo (USDT)</th>}
                      <th style={{ padding: '10px 14px' }}>Status</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedBalanceResults.map((item, idx) => {
                      const hasNativeBalance = (item.balanceNum || 0) > 0;
                      const hasUsdtBalance = (item.usdtBalanceNum || 0) > 0;
                      const hasAnyBalance = hasNativeBalance || hasUsdtBalance;
                      return (
                        <tr
                          key={item.address + idx}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                            background: hasAnyBalance ? 'rgba(16, 185, 129, 0.03)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {idx + 1}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 600 }}>{item.name}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{formatAddress(item.address, 8, 6)}</span>
                              <button
                                onClick={() => handleCopy(item.address, `chk_addr_${idx}`, 'Alamat disalin!')}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedId === `chk_addr_${idx}` ? '#10b981' : 'var(--text-muted)' }}
                              >
                                {copiedId === `chk_addr_${idx}` ? <Check size={13} /> : <Copy size={13} />}
                              </button>
                              {activeCheckerNetwork.explorerUrl && (
                                <a
                                  href={`${activeCheckerNetwork.explorerUrl}/address/${item.address}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                                >
                                  <ExternalLink size={13} />
                                </a>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: hasNativeBalance ? '#10b981' : 'var(--text-muted)' }}>
                            {parseFloat(item.balance).toFixed(4)} {activeCheckerNetwork.symbol}
                          </td>
                          {activeUsdtToken && (
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700, color: hasUsdtBalance ? '#26a17b' : 'var(--text-muted)' }}>
                              {parseFloat(item.usdtBalance || 0).toFixed(4)} USDT
                            </td>
                          )}
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                background: hasAnyBalance ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                color: hasAnyBalance ? '#10b981' : 'var(--text-muted)'
                              }}
                            >
                              {hasAnyBalance ? 'Ada Saldo' : 'Nol'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                onAddWalletsBatch([item]);
                                onSelectWallet(item);
                                onNotify?.(`${item.name} diaktifkan!`, 'success');
                              }}
                              className="btn btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                            >
                              Pilih
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BULK IMPORTER */}
      {/* ========================================================================= */}
      {activeSubTab === 'importer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UploadCloud size={18} color="#06b6d4" />
              <span>Impor Massal (Paste Data Banyak Wallet)</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
              Mendukung campuran Private Key (0x...), Seed Phrase (12/24 kata), atau Alamat EVM publik (Watch-Only) baris demi baris atau format CSV.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Prefix Nama Wallet Baru:
              </label>
              <input
                type="text"
                value={importPrefix}
                onChange={(e) => setImportPrefix(e.target.value)}
                style={{
                  width: '260px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>
                Tempel Data di Sini:
              </label>
              <textarea
                rows={8}
                value={importRawText}
                onChange={(e) => setImportRawText(e.target.value)}
                placeholder="0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d&#10;0xa6b3aF2b471C7E1bB110e04b5a897610A86b0824&#10;canyon easy ability paper save all neither teach practice cross uphold sunny"
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '14px',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.82rem',
                  lineHeight: 1.5
                }}
              />
            </div>

            {/* Realtime detection preview */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '14px 18px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '16px'
              }}
            >
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Hasil Deteksi: </span>
                <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700 }}>
                  {parsedImportPreview.length} Wallet Valid
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  ({parsedImportPreview.filter((p) => p.privateKey && !p.mnemonic).length} Private Key,{' '}
                  {parsedImportPreview.filter((p) => p.mnemonic).length} Mnemonic,{' '}
                  {parsedImportPreview.filter((p) => p.isWatchOnly).length} Watch-Only)
                </span>
              </div>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={parsedImportPreview.length === 0}
                className="btn btn-primary"
                style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              >
                <Save size={16} />
                <span>Simpan {parsedImportPreview.length} Wallet ke Aplikasi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
