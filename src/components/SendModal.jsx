import React, { useState, useEffect } from 'react';
import { X, Send, AlertCircle, CheckCircle2, ExternalLink, ArrowRight, Fuel } from 'lucide-react';
import { validateAddress } from '../services/wallet';
import { estimateTransferGas, sendTransfer } from '../services/tokens';
import { PinModal } from './PinModal';
import { hasPinConfigured, decryptWithPin } from '../services/security';

export const SendModal = ({
  isOpen,
  onClose,
  activeWallet,
  network,
  nativeBalance,
  tokens = [],
  initialToken = null,
  onSuccessTx,
  onNotify
}) => {
  const [selectedAsset, setSelectedAsset] = useState('native'); // 'native' or token address
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [gasInfo, setGasInfo] = useState(null);
  const [isEstimatingGas, setIsEstimatingGas] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentTxHash, setSentTxHash] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Reset or initialize when opened
  useEffect(() => {
    if (isOpen) {
      if (initialToken) {
        setSelectedAsset(initialToken.address);
      } else {
        setSelectedAsset('native');
      }
      setRecipient('');
      setAmount('');
      setGasInfo(null);
      setSentTxHash(null);
      setErrorMessage('');
    }
  }, [isOpen, initialToken]);

  // Find currently selected token object if not native
  const currentToken = selectedAsset === 'native'
    ? null
    : tokens.find((t) => t.address.toLowerCase() === selectedAsset.toLowerCase()) || null;

  const currentSymbol = currentToken ? currentToken.symbol : network.symbol;
  const currentMaxBalance = currentToken ? (currentToken.balance || '0') : (nativeBalance || '0');

  // Estimate gas when recipient and amount are provided
  useEffect(() => {
    let active = true;
    const updateGas = async () => {
      if (!validateAddress(recipient) || !amount || parseFloat(amount) <= 0 || !activeWallet) {
        setGasInfo(null);
        return;
      }

      setIsEstimatingGas(true);
      try {
        const est = await estimateTransferGas({
          fromAddress: activeWallet.address,
          toAddress: recipient.trim(),
          amount,
          token: currentToken,
          network
        });
        if (active) setGasInfo(est);
      } catch (err) {
        if (active) setGasInfo(null);
      } finally {
        if (active) setIsEstimatingGas(false);
      }
    };

    const timer = setTimeout(updateGas, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [recipient, amount, selectedAsset, activeWallet, network]);

  if (!isOpen) return null;

  const handleSetMax = () => {
    if (selectedAsset === 'native') {
      // Keep safety margin for gas fee (0.001 ETH/BNB)
      const numBal = parseFloat(currentMaxBalance);
      const safeAmount = Math.max(0, numBal - 0.001).toFixed(5);
      setAmount(safeAmount > 0 ? safeAmount.toString() : currentMaxBalance);
    } else {
      setAmount(currentMaxBalance);
    }
  };

  const handlePasteRecipient = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setRecipient(text.trim());
    } catch {
      onNotify?.('Gagal membaca clipboard', 'error');
    }
  };

  const executeSend = async (plainPrivateKey) => {
    setIsSending(true);
    try {
      const tx = await sendTransfer({
        privateKey: plainPrivateKey,
        toAddress: recipient.trim(),
        amount: amount.trim(),
        token: currentToken,
        network
      });

      setSentTxHash(tx.hash);
      onNotify?.(`Transaksi berhasil dikirim: ${tx.hash.substring(0, 10)}...`, 'success');

      if (onSuccessTx) {
        onSuccessTx({
          hash: tx.hash,
          from: activeWallet.address,
          to: recipient.trim(),
          value: amount,
          symbol: currentSymbol,
          timeStamp: Date.now(),
          isOutgoing: true,
          type: currentToken ? 'token' : 'native'
        });
      }
    } catch (err) {
      console.error('Send error:', err);
      setErrorMessage(err.reason || err.message || 'Transaksi gagal dikirim.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (activeWallet?.isWatchOnly) {
      setErrorMessage('Akun ini adalah Watch-Only (hanya pantau) dan tidak memiliki Private Key untuk mengirim transaksi.');
      return;
    }

    if (!validateAddress(recipient)) {
      setErrorMessage('Alamat penerima tidak valid (harus format 0x...).');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Jumlah transfer harus lebih dari 0.');
      return;
    }

    if (numAmount > parseFloat(currentMaxBalance)) {
      setErrorMessage(`Saldo ${currentSymbol} tidak mencukupi.`);
      return;
    }

    // Require PIN verification if security PIN is configured
    if (hasPinConfigured()) {
      setIsPinModalOpen(true);
      return;
    }

    // Direct send if user hasn't set up a PIN yet
    await executeSend(activeWallet.privateKey);
  };

  const handlePinVerified = async (pin) => {
    setIsPinModalOpen(false);
    let key = activeWallet.privateKey;
    if (key && typeof key === 'object') {
      try {
        key = await decryptWithPin(key, pin);
      } catch (err) {
        setErrorMessage('Gagal mendekripsi private key: ' + err.message);
        return;
      }
    }
    await executeSend(key);
  };

  const explorerTxUrl = sentTxHash && network.explorerUrl
    ? `${network.explorerUrl}/tx/${sentTxHash}`
    : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}>
              <Send size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Kirim Aset Kripto</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jaringan: {network.name}</span>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px', borderRadius: '8px' }}>
            <X size={18} />
          </button>
        </div>

        {sentTxHash ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle2 size={56} color="#10b981" style={{ margin: '0 auto 16px auto' }} />
            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Transaksi Terkirim!</h4>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Transaksi Anda sedang diproses oleh jaringan {network.name}.
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              marginBottom: '20px',
              wordBreak: 'break-all',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)'
            }}>
              Tx Hash: {sentTxHash}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {explorerTxUrl && (
                <a
                  href={explorerTxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  <ExternalLink size={16} />
                  <span>Lihat di Blockscout</span>
                </a>
              )}
              <button onClick={onClose} className="btn btn-primary">
                Selesai
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Asset Selection */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Pilih Aset / Token
              </label>
              <select
                className="input-field"
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="native">{network.name} ({network.symbol}) - Native</option>
                {tokens.map((tok) => (
                  <option key={tok.address} value={tok.address}>
                    {tok.symbol} - {tok.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient Input */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Alamat Penerima (0x...)
                </label>
                <button
                  type="button"
                  onClick={handlePasteRecipient}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Tempel (Paste)
                </button>
              </div>
              <input
                type="text"
                placeholder="0x..."
                className="input-field input-mono"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
              />
            </div>

            {/* Amount Input */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Jumlah Transfer
                </label>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Saldo: {parseFloat(currentMaxBalance).toLocaleString('en-US', { maximumFractionDigits: 6 })} {currentSymbol}
                  <button
                    type="button"
                    onClick={handleSetMax}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-primary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      marginLeft: '6px'
                    }}
                  >
                    MAX
                  </button>
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  step="any"
                  placeholder="0.0"
                  className="input-field"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <span style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)'
                }}>
                  {currentSymbol}
                </span>
              </div>
            </div>

            {/* Estimated Gas Fee */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
              padding: '12px 14px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.825rem'
            }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Fuel size={14} color="var(--accent-amber)" /> Estimasi Biaya Gas
              </span>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {isEstimatingGas ? 'Menghitung...' : gasInfo ? `~${parseFloat(gasInfo.estimatedFee).toFixed(6)} ${gasInfo.feeSymbol}` : `~0.0001 ${network.symbol}`}
              </span>
            </div>

            {/* Error notice */}
            {errorMessage && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#fda4af',
                fontSize: '0.825rem'
              }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {activeWallet?.isWatchOnly && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#fcd34d',
                fontSize: '0.8rem',
                lineHeight: 1.4
              }}>
                Perhatian: Wallet ini dalam status <strong>Pantau Alamat (Watch-Only)</strong> tanpa Private Key. Untuk menandatangani dan mengirim transaksi, silakan impor menggunakan Private Key atau Mnemonic.
              </div>
            )}

            {/* Submit Button */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginTop: '6px' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSending}>
                Batal
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSending || !amount || !recipient || activeWallet?.isWatchOnly}
              >
                {activeWallet?.isWatchOnly
                  ? 'Mode Pantau (Tidak Ada Key)'
                  : isSending
                  ? 'Mengirim Transaksi...'
                  : 'Konfirmasi & Kirim'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* PIN Verification Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        mode="verify"
        title="Otorisasi Transaksi"
        subtitle={`Ketik 6 digit PIN untuk menyetujui transfer ${amount} ${currentSymbol}`}
        onSuccess={handlePinVerified}
        onCancel={() => setIsPinModalOpen(false)}
      />
    </div>
  );
};
