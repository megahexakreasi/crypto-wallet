import React, { useState, useEffect } from 'react';
import {
  Wallet,
  PlusCircle,
  Download,
  Key,
  Shield,
  Copy,
  Check,
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
  QrCode,
  Lock,
  Layers
} from 'lucide-react';
import {
  createNewWallet,
  importWalletFromMnemonic,
  importWalletFromPrivateKey,
  importWatchOnlyWallet,
  formatAddress
} from '../services/wallet';

export const OnboardingView = ({ onWalletReady, onNotify, onOpenScanQr }) => {
  // 'welcome' | 'create' | 'import'
  const [step, setStep] = useState('welcome');

  // Create Wallet State
  const [newWallet, setNewWallet] = useState(null);
  const [newWalletName, setNewWalletName] = useState('Dompet Utama');
  const [isCopied, setIsCopied] = useState(false);
  const [hasBackedUp, setHasBackedUp] = useState(false);

  // Import Wallet State
  const [importType, setImportType] = useState('privateKey'); // 'privateKey' | 'mnemonic' | 'watchOnly'
  const [importInput, setImportInput] = useState('');
  const [importName, setImportName] = useState('Akun Import');
  const [importError, setImportError] = useState('');
  const [showInputKey, setShowInputKey] = useState(false);

  // Generate wallet when entering 'create' step
  const handleStartCreate = () => {
    try {
      const generated = createNewWallet('Dompet Utama');
      setNewWallet(generated);
      setNewWalletName('Dompet Utama');
      setHasBackedUp(false);
      setStep('create');
    } catch (err) {
      onNotify?.('Gagal membuat wallet: ' + err.message, 'error');
    }
  };

  const handleCopyPhrase = () => {
    if (!newWallet?.mnemonic) return;
    navigator.clipboard.writeText(newWallet.mnemonic);
    setIsCopied(true);
    onNotify?.('12 Frase Pemulihan berhasil disalin!', 'success');
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleFinishCreate = () => {
    if (!newWallet) return;
    const finalWallet = {
      ...newWallet,
      name: newWalletName.trim() || 'Dompet Utama'
    };
    onWalletReady(finalWallet);
    onNotify?.('Wallet baru berhasil dibuat & disimpan lokal!', 'success');
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setImportInput(text.trim());
        setImportError('');
        onNotify?.('Teks berhasil ditempel dari clipboard', 'info');
      }
    } catch {
      onNotify?.('Izin akses clipboard ditolak oleh browser', 'error');
    }
  };

  const handleImportSubmit = (e) => {
    e.preventDefault();
    setImportError('');

    if (!importInput.trim()) {
      setImportError('Mohon masukkan kunci atau frase pemulihan.');
      return;
    }

    try {
      let imported;
      if (importType === 'mnemonic') {
        imported = importWalletFromMnemonic(importInput, importName || 'Akun Mnemonic');
      } else if (importType === 'privateKey') {
        imported = importWalletFromPrivateKey(importInput, importName || 'Akun Private Key');
      } else {
        imported = importWatchOnlyWallet(importInput, importName || 'Akun Pantau');
      }

      onWalletReady(imported);
      onNotify?.(`Wallet "${imported.name}" berhasil diimpor!`, 'success');
    } catch (err) {
      setImportError(err.message || 'Format tidak valid. Periksa kembali input Anda.');
    }
  };

  return (
    <div style={{
      maxWidth: '640px',
      margin: '20px auto 40px auto',
      padding: '0 16px'
    }}>
      {/* ========================================================
          1. WELCOME SCREEN
      ======================================================== */}
      {step === 'welcome' && (
        <div className="card" style={{
          textAlign: 'center',
          padding: '40px 24px',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(180deg, rgba(30, 35, 55, 0.7) 0%, rgba(17, 24, 39, 0.9) 100%)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5)'
        }}>
          {/* Glowing Hero Icon */}
          <div style={{
            width: '76px',
            height: '76px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px auto',
            boxShadow: '0 10px 30px rgba(99, 102, 241, 0.45)'
          }}>
            <Wallet size={38} color="#ffffff" />
          </div>

          <h2 style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            marginBottom: '8px',
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #ffffff 30%, #cbd5e1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Selamat Datang di Web Wallet
          </h2>

          <p style={{
            color: 'var(--text-muted)',
            fontSize: '0.95rem',
            lineHeight: 1.5,
            maxWidth: '460px',
            margin: '0 auto 32px auto'
          }}>
            Dompet kripto EVM multi-chain non-custodial. Kunci rahasia dan saldo Anda 100% aman di bawah kendali Anda sendiri.
          </p>

          {/* Action Cards */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            marginBottom: '32px'
          }}>
            {/* Action 1: Create Wallet */}
            <div
              onClick={handleStartCreate}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '18px 20px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
              className="hover-card"
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0
              }}>
                <PlusCircle size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff' }}>Buat Wallet Baru</span>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: 'rgba(99, 102, 241, 0.25)',
                    color: '#a5b4fc',
                    fontWeight: 600
                  }}>
                    Rekomendasi
                  </span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Buat akun baru dengan 12 Frase Pemulihan rahasia (Mnemonic Phrase).
                </div>
              </div>
            </div>

            {/* Action 2: Import Wallet */}
            <div
              onClick={() => {
                setImportInput('');
                setImportError('');
                setStep('import');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '18px 20px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
              className="hover-card"
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                flexShrink: 0
              }}>
                <Download size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff', marginBottom: '2px' }}>
                  Import Wallet yang Sudah Ada
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Gunakan Private Key, Frase Pemulihan 12 Kata, atau alamat pantau.
                </div>
              </div>
            </div>
          </div>

          {/* Security Features Info */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Lock size={15} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-normal)', display: 'block' }}>100% Non-Custodial</strong>
                Kunci tersimpan hanya di memori browser lokal.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Layers size={15} color="#6366f1" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-normal)', display: 'block' }}>Multi-Chain EVM</strong>
                MTT Network, BNB Chain, Ethereum, dll.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Shield size={15} color="#06b6d4" style={{ marginTop: '2px', flexShrink: 0 }} />
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-normal)', display: 'block' }}>Tanpa Registrasi</strong>
                Bebas KYC & server database luar.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          2. CREATE WALLET SCREEN
      ======================================================== */}
      {step === 'create' && newWallet && (
        <div className="card" style={{
          padding: '30px 24px',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'var(--card-bg)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <button
              onClick={() => setStep('welcome')}
              className="btn btn-ghost"
              style={{ padding: '8px', borderRadius: '10px' }}
              title="Kembali"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Simpan Frase Pemulihan</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Langkah 1 dari 1 &bull; Kunci Cadangan Akun</span>
            </div>
          </div>

          {/* Warning Banner */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.82rem', color: '#fbbf24', lineHeight: 1.45 }}>
              <strong>PENTING:</strong> Catat dan simpan ke-12 kata berikut secara offline di tempat yang aman. Siapapun yang memiliki 12 kata ini dapat mengambil saldo Anda. Jangan berikan kepada siapa pun!
            </div>
          </div>

          {/* 12 Mnemonic Words Grid */}
          {newWallet.mnemonic && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                padding: '16px',
                borderRadius: '16px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-color)',
                marginBottom: '12px'
              }}>
                {newWallet.mnemonic.split(' ').map((word, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: '16px' }}>
                      {idx + 1}.
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f8fafc', letterSpacing: '0.02em' }}>
                      {word}
                    </span>
                  </div>
                ))}
              </div>

              {/* Copy button */}
              <button
                onClick={handleCopyPhrase}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '10px', fontSize: '0.88rem', justifyContent: 'center' }}
              >
                {isCopied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
                <span>{isCopied ? 'Tersalin ke Clipboard!' : 'Salin 12 Kata Pemulihan'}</span>
              </button>
            </div>
          )}

          {/* Wallet Name Field */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Nama Wallet
            </label>
            <input
              type="text"
              className="input-field"
              value={newWalletName}
              onChange={(e) => setNewWalletName(e.target.value)}
              placeholder="Contoh: Dompet Utama"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px' }}
            />
          </div>

          {/* Generated Address Preview */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-color)',
            marginBottom: '22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Alamat Publik:</span>
            <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {formatAddress(newWallet.address, 8, 6)}
            </span>
          </div>

          {/* Backup confirmation checkbox */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            marginBottom: '20px',
            fontSize: '0.85rem',
            userSelect: 'none'
          }}>
            <input
              type="checkbox"
              checked={hasBackedUp}
              onChange={(e) => setHasBackedUp(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
            />
            <span>Saya telah mencatat & menyimpan 12 kata pemulihan dengan aman.</span>
          </label>

          {/* Finish Button */}
          <button
            onClick={handleFinishCreate}
            disabled={!hasBackedUp}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '1rem',
              fontWeight: 700,
              justifyContent: 'center',
              opacity: hasBackedUp ? 1 : 0.5,
              cursor: hasBackedUp ? 'pointer' : 'not-allowed'
            }}
          >
            <Sparkles size={18} />
            <span>Selesaikan & Buka Dompet</span>
          </button>
        </div>
      )}

      {/* ========================================================
          3. IMPORT WALLET SCREEN
      ======================================================== */}
      {step === 'import' && (
        <div className="card" style={{
          padding: '30px 24px',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'var(--card-bg)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <button
              onClick={() => setStep('welcome')}
              className="btn btn-ghost"
              style={{ padding: '8px', borderRadius: '10px' }}
              title="Kembali"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Import Wallet</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Akses wallet yang sudah Anda miliki</span>
            </div>
          </div>

          {/* Import Type Tabs */}
          <div className="tabs-nav" style={{ marginBottom: '18px' }}>
            <button
              className={`tab-btn ${importType === 'privateKey' ? 'active' : ''}`}
              onClick={() => {
                setImportType('privateKey');
                setImportError('');
              }}
              style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem' }}
            >
              Private Key
            </button>
            <button
              className={`tab-btn ${importType === 'mnemonic' ? 'active' : ''}`}
              onClick={() => {
                setImportType('mnemonic');
                setImportError('');
              }}
              style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem' }}
            >
              12 Kata (Seed)
            </button>
            <button
              className={`tab-btn ${importType === 'watchOnly' ? 'active' : ''}`}
              onClick={() => {
                setImportType('watchOnly');
                setImportError('');
              }}
              style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem' }}
            >
              Mode Pantau
            </button>
          </div>

          <form onSubmit={handleImportSubmit}>
            {/* Input Label & Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {importType === 'privateKey' && 'Private Key (64 karakter hex):'}
                {importType === 'mnemonic' && '12 atau 24 Frase Kata (dipisahkan spasi):'}
                {importType === 'watchOnly' && 'Alamat Publik (0x...):'}
              </label>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="btn btn-ghost"
                  style={{ padding: '3px 8px', fontSize: '0.75rem', color: 'var(--accent-primary)' }}
                >
                  <Copy size={12} />
                  <span>Tempel</span>
                </button>
                {onOpenScanQr && (
                  <button
                    type="button"
                    onClick={onOpenScanQr}
                    className="btn btn-ghost"
                    style={{ padding: '3px 8px', fontSize: '0.75rem', color: '#06b6d4' }}
                    title="Scan QR Code"
                  >
                    <QrCode size={12} />
                    <span>Scan QR</span>
                  </button>
                )}
              </div>
            </div>

            {/* Input Field / Textarea */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <textarea
                className="input-field"
                rows={3}
                value={importInput}
                onChange={(e) => {
                  setImportInput(e.target.value);
                  setImportError('');
                }}
                placeholder={
                  importType === 'privateKey'
                    ? '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'
                    : importType === 'mnemonic'
                    ? 'word1 word2 word3 ... word12'
                    : '0x71C...39724'
                }
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  resize: 'none'
                }}
              />
            </div>

            {/* Wallet Name Field */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Nama Wallet
              </label>
              <input
                type="text"
                className="input-field"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                placeholder="Contoh: Akun Trading / Akun Utama"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px' }}
              />
            </div>

            {/* Error Message */}
            {importError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: '#f87171',
                fontSize: '0.82rem',
                marginBottom: '18px'
              }}>
                {importError}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '1rem',
                fontWeight: 700,
                justifyContent: 'center'
              }}
            >
              <Download size={18} />
              <span>Impor & Masuk ke Dompet</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
