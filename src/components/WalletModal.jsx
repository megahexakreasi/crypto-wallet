import React, { useState } from 'react';
import { X, Wallet, Plus, Download, Key, Shield, Copy, Check, Eye, EyeOff, AlertTriangle, Trash2, QrCode, Lock } from 'lucide-react';
import {
  createNewWallet,
  importWalletFromMnemonic,
  importWalletFromPrivateKey,
  importWatchOnlyWallet,
  formatAddress
} from '../services/wallet';
import { PinModal } from './PinModal';
import { hasPinConfigured, decryptWallet } from '../services/security';

export const WalletModal = ({
  isOpen,
  onClose,
  wallets = [],
  activeWallet,
  onSelectWallet,
  onAddWallet,
  onRemoveWallet,
  onOpenScanQr,
  onNotify
}) => {
  const [tab, setTab] = useState('list'); // 'list', 'create', 'import', 'export'
  const [copiedText, setCopiedText] = useState(null);

  // Create state
  const [createdWalletData, setCreatedWalletData] = useState(null);
  const [newWalletName, setNewWalletName] = useState('Wallet Baru');

  // Import state
  const [importType, setImportType] = useState('watchOnly'); // 'watchOnly', 'mnemonic', 'privateKey'
  const [importInput, setImportInput] = useState('');
  const [importName, setImportName] = useState('Akun Pantau');
  const [importError, setImportError] = useState('');

  // Export reveal state & PIN protection
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlockedCredentials, setUnlockedCredentials] = useState(null);

  if (!isOpen) return null;

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    const isSensitive = label.toLowerCase().includes('private key') || label.toLowerCase().includes('seed');
    if (isSensitive) {
      onNotify?.(`${label} disalin! (Otomatis dihapus dari clipboard dlm 45 detik)`, 'success');
      // Auto-clear clipboard after 45s for security
      setTimeout(async () => {
        try {
          const current = await navigator.clipboard.readText();
          if (current === text) {
            await navigator.clipboard.writeText('');
            onNotify?.('Clipboard kunci rahasia telah dibersihkan otomatis.', 'info');
          }
        } catch {
          // ignore
        }
      }, 45000);
    } else {
      onNotify?.(`${label} berhasil disalin!`, 'success');
    }
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleGenerateWallet = () => {
    try {
      const generated = createNewWallet(newWalletName);
      setCreatedWalletData(generated);
    } catch (e) {
      onNotify?.('Gagal membuat wallet: ' + e.message, 'error');
    }
  };

  const handleSaveCreatedWallet = () => {
    if (!createdWalletData) return;
    onAddWallet(createdWalletData);
    onSelectWallet(createdWalletData);
    setCreatedWalletData(null);
    setTab('list');
    onNotify?.('Wallet baru berhasil disimpan dan diaktifkan!', 'success');
    onClose();
  };

  const handleImportSubmit = (e) => {
    e.preventDefault();
    setImportError('');
    try {
      let imported;
      if (importType === 'mnemonic') {
        imported = importWalletFromMnemonic(importInput, importName);
      } else if (importType === 'privateKey') {
        imported = importWalletFromPrivateKey(importInput, importName);
      } else {
        imported = importWatchOnlyWallet(importInput, importName);
      }

      onAddWallet(imported);
      onSelectWallet(imported);
      setImportInput('');
      setTab('list');
      onNotify?.('Wallet berhasil ditambahkan dan diaktifkan!', 'success');
      onClose();
    } catch (err) {
      setImportError(err.message || 'Gagal mengimpor wallet.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', maxWidth: '520px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
              <Wallet size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Manajemen Wallet</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Non-custodial &bull; Tersimpan Lokal</span>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px', borderRadius: '8px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs inside modal */}
        <div className="tabs-nav" style={{ marginBottom: '18px' }}>
          <button
            className={`tab-btn ${tab === 'list' ? 'active' : ''}`}
            onClick={() => {
              setTab('list');
              setCreatedWalletData(null);
              setIsUnlocked(false);
              setUnlockedCredentials(null);
              setShowPrivateKey(false);
            }}
          >
            Daftar Akun
          </button>
          <button
            className={`tab-btn ${tab === 'create' ? 'active' : ''}`}
            onClick={() => {
              setTab('create');
              handleGenerateWallet();
              setIsUnlocked(false);
              setUnlockedCredentials(null);
              setShowPrivateKey(false);
            }}
          >
            Buat Baru
          </button>
          <button
            className={`tab-btn ${tab === 'import' ? 'active' : ''}`}
            onClick={() => {
              setTab('import');
              setIsUnlocked(false);
              setUnlockedCredentials(null);
              setShowPrivateKey(false);
            }}
          >
            Impor Akun
          </button>
          {activeWallet && (
            <button
              className={`tab-btn ${tab === 'export' ? 'active' : ''}`}
              onClick={() => {
                setTab('export');
                setIsUnlocked(false);
                setUnlockedCredentials(null);
                setShowPrivateKey(false);
              }}
            >
              Kunci / Backup
            </button>
          )}
        </div>

        {/* TAB 1: WALLET LIST */}
        {tab === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {wallets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)' }}>
                Belum ada wallet tersimpan. Silakan klik "Buat Baru" atau "Impor Akun".
              </div>
            ) : (
              wallets.map((w) => {
                const isActive = activeWallet?.id === w.id;
                return (
                  <div
                    key={w.id}
                    onClick={() => {
                      onSelectWallet(w);
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      background: isActive ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 700
                      }}>
                        {w.name?.substring(0, 1).toUpperCase() || 'W'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.925rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{w.name}</span>
                          {w.isWatchOnly && (
                            <span style={{
                              fontSize: '0.65rem',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              padding: '1px 6px',
                              borderRadius: '6px'
                            }}>
                              Watch-Only
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {formatAddress(w.address, 6, 4)}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                      {isActive && (
                        <span style={{
                          fontSize: '0.72rem',
                          background: 'rgba(99, 102, 241, 0.2)',
                          color: '#818cf8',
                          padding: '2px 8px',
                          borderRadius: '8px',
                          fontWeight: 600
                        }}>
                          Aktif
                        </span>
                      )}
                      {wallets.length > 1 && (
                        <button
                          onClick={() => onRemoveWallet(w.id)}
                          className="btn btn-ghost"
                          style={{ padding: '6px', borderRadius: '8px', color: '#f43f5e' }}
                          title="Hapus wallet ini"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => { setTab('create'); handleGenerateWallet(); }} className="btn btn-primary" style={{ padding: '10px' }}>
                <Plus size={16} />
                <span>Buat Wallet Baru</span>
              </button>
              <button onClick={() => setTab('import')} className="btn btn-secondary" style={{ padding: '10px' }}>
                <Download size={16} />
                <span>Impor Wallet</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: CREATE WALLET */}
        {tab === 'create' && createdWalletData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Nama Wallet
              </label>
              <input
                type="text"
                className="input-field"
                value={createdWalletData.name}
                onChange={(e) => setCreatedWalletData({ ...createdWalletData, name: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Alamat Publik (Ethereum & EVM)
              </label>
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.825rem',
                wordBreak: 'break-all'
              }}>
                {createdWalletData.address}
              </div>
            </div>

            {/* Seed Phrase (12 Words) */}
            {createdWalletData.mnemonic && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399' }}>
                    12 Kata Pemulihan (Secret Seed Phrase)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy(createdWalletData.mnemonic, 'Seed phrase')}
                    className="btn btn-ghost"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                  >
                    {copiedText === 'Seed phrase' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>Salin</span>
                  </button>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '8px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)'
                }}>
                  {createdWalletData.mnemonic.split(' ').map((word, i) => (
                    <div key={i} style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      display: 'flex',
                      gap: '6px',
                      alignItems: 'center'
                    }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{i + 1}.</span>
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{word}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              padding: '10px 14px',
              borderRadius: '12px',
              display: 'flex',
              gap: '8px',
              fontSize: '0.75rem',
              color: '#fcd34d'
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                Simpan 12 kata ini di tempat aman. Siapapun yang memiliki seed phrase dapat mengakses wallet Anda di ETH, BSC, maupun MTT!
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginTop: '6px' }}>
              <button onClick={() => setTab('list')} className="btn btn-secondary">
                Kembali
              </button>
              <button onClick={handleSaveCreatedWallet} className="btn btn-primary">
                Simpan & Gunakan Wallet
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: IMPORT WALLET */}
        {tab === 'import' && (
          <form onSubmit={handleImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Quick Scan QR button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenScanQr?.();
              }}
              className="btn btn-secondary"
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '0.85rem',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                background: 'rgba(6, 182, 212, 0.08)'
              }}
            >
              <QrCode size={16} color="#06b6d4" />
              <span>Scan QR Code (Kamera / File Gambar)</span>
            </button>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className={`btn ${importType === 'watchOnly' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '8px 10px', fontSize: '0.78rem' }}
                onClick={() => { setImportType('watchOnly'); setImportName('Akun Pantau'); }}
              >
                Pantau Alamat
              </button>
              <button
                type="button"
                className={`btn ${importType === 'mnemonic' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '8px 10px', fontSize: '0.78rem' }}
                onClick={() => { setImportType('mnemonic'); setImportName('Akun Mnemonic'); }}
              >
                12 Kata Seed
              </button>
              <button
                type="button"
                className={`btn ${importType === 'privateKey' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1, padding: '8px 10px', fontSize: '0.78rem' }}
                onClick={() => { setImportType('privateKey'); setImportName('Akun Private Key'); }}
              >
                Private Key
              </button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Nama Akun
              </label>
              <input
                type="text"
                className="input-field"
                value={importName}
                onChange={(e) => setImportName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                {importType === 'watchOnly'
                  ? 'Alamat EVM Publik (0x...)'
                  : importType === 'mnemonic'
                  ? 'Masukkan 12 atau 24 Kata (dipisahkan spasi)'
                  : 'Masukkan Private Key (0x...)'}
              </label>
              <textarea
                rows={importType === 'watchOnly' ? 2 : 3}
                className="input-field input-mono"
                placeholder={
                  importType === 'watchOnly'
                    ? '0xa6b3aF2b471C7E1bB110e04b5a897610A86b0824'
                    : importType === 'mnemonic'
                    ? 'word1 word2 word3 ... word12'
                    : '0x...'
                }
                value={importInput}
                onChange={(e) => setImportInput(e.target.value)}
                required
              />
              {importType === 'watchOnly' && (
                <span style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '4px', display: 'block' }}>
                  ✓ Cukup masukkan alamat untuk cek saldo koin/token & riwayat transaksi dari Blockscout tanpa resiko private key.
                </span>
              )}
            </div>

            {importError && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                padding: '10px 14px',
                borderRadius: '10px',
                color: '#fda4af',
                fontSize: '0.8rem'
              }}>
                {importError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginTop: '6px' }}>
              <button type="button" onClick={() => setTab('list')} className="btn btn-secondary">
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={!importInput.trim()}>
                Impor Sekarang
              </button>
            </div>
          </form>
        )}

        {/* TAB 4: EXPORT / BACKUP CURRENT WALLET */}
        {tab === 'export' && activeWallet && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Wallet Aktif:</div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{activeWallet.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {activeWallet.address}
              </div>
            </div>

            {activeWallet.isWatchOnly ? (
              <div style={{
                background: 'rgba(244, 63, 94, 0.08)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                padding: '16px',
                borderRadius: '12px',
                textAlign: 'center',
                color: '#fda4af',
                fontSize: '0.85rem'
              }}>
                <AlertTriangle size={24} style={{ margin: '0 auto 8px auto', display: 'block' }} />
                Akun ini berjenis <strong>Watch-Only</strong> (hanya pantau). Anda tidak memiliki Seed Phrase atau Private Key untuk akun ini di perangkat ini.
              </div>
            ) : hasPinConfigured() && !isUnlocked ? (
              <div style={{
                textAlign: 'center',
                padding: '30px 20px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '16px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                  margin: '0 auto 14px auto'
                }}>
                  <Lock size={26} />
                </div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '6px' }}>
                  Kunci Rahasia Terproteksi PIN
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '360px', margin: '0 auto 20px auto', lineHeight: 1.5 }}>
                  Frase Pemulihan & Private Key tersimpan aman dengan enkripsi AES-256 GCM. Masukkan 6-digit PIN keamanan Anda untuk membukanya.
                </p>
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(true)}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
                >
                  <Key size={16} /> Buka Kunci dengan PIN
                </button>
              </div>
            ) : (
              <>
                {/* Mnemonic backup if available */}
                {(unlockedCredentials?.mnemonic || (typeof activeWallet.mnemonic === 'string' && activeWallet.mnemonic)) && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Seed Phrase (12 Kata)
                      </label>
                      <button
                        type="button"
                        onClick={() => handleCopy(unlockedCredentials?.mnemonic || activeWallet.mnemonic, 'Seed phrase')}
                        className="btn btn-ghost"
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      >
                        <Copy size={12} /> Salin
                      </button>
                    </div>
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.4)',
                      padding: '12px',
                      borderRadius: '10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.825rem',
                      lineHeight: 1.6,
                      border: '1px solid var(--border-color)'
                    }}>
                      {unlockedCredentials?.mnemonic || activeWallet.mnemonic}
                    </div>
                  </div>
                )}

                {/* Private key backup */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Private Key
                    </label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setShowPrivateKey(!showPrivateKey)}
                        className="btn btn-ghost"
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      >
                        {showPrivateKey ? <EyeOff size={12} /> : <Eye size={12} />}
                        {showPrivateKey ? 'Sembunyikan' : 'Tampilkan'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(unlockedCredentials?.privateKey || activeWallet.privateKey, 'Private Key')}
                        className="btn btn-ghost"
                        style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      >
                        <Copy size={12} /> Salin
                      </button>
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: '12px',
                    borderRadius: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    wordBreak: 'break-all',
                    border: '1px solid var(--border-color)',
                    color: showPrivateKey ? '#fda4af' : 'var(--text-muted)'
                  }}>
                    {showPrivateKey
                      ? (unlockedCredentials?.privateKey || activeWallet.privateKey)
                      : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                  </div>
                </div>

                {hasPinConfigured() && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnlocked(false);
                      setUnlockedCredentials(null);
                      setShowPrivateKey(false);
                      onNotify?.('Kunci kembali terkunci.', 'info');
                    }}
                    className="btn btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Lock size={14} /> Kunci Kembali
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => {
                setTab('list');
                setIsUnlocked(false);
                setUnlockedCredentials(null);
                setShowPrivateKey(false);
              }}
              className="btn btn-secondary"
              style={{ marginTop: '8px' }}
            >
              Tutup / Kembali
            </button>
          </div>
        )}
      </div>

      {/* PIN Verification Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        mode="verify"
        title="Buka Kunci Akses"
        subtitle="Ketik 6 digit PIN untuk melihat Seed Phrase & Private Key."
        onSuccess={async (pin) => {
          setIsPinModalOpen(false);
          try {
            const dec = await decryptWallet(activeWallet, pin);
            setUnlockedCredentials({
              privateKey: dec.privateKey,
              mnemonic: dec.mnemonic
            });
            setIsUnlocked(true);
            onNotify?.('Kunci berhasil dibuka!', 'success');
          } catch (err) {
            onNotify?.(err.message || 'Gagal mendekripsi kunci.', 'error');
          }
        }}
        onCancel={() => setIsPinModalOpen(false)}
      />
    </div>
  );
};
