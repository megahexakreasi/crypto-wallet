import React, { useState } from 'react';
import { X, Copy, Check, QrCode, AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export const ReceiveModal = ({
  isOpen,
  onClose,
  activeWallet,
  network,
  onNotify
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !activeWallet) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeWallet.address);
    setCopied(true);
    onNotify?.('Alamat berhasil disalin!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', maxWidth: '440px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-emerald)'
            }}>
              <QrCode size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Terima Aset Kripto</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jaringan: {network.name}</span>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px', borderRadius: '8px' }}>
            <X size={18} />
          </button>
        </div>

        {/* QR Code Container */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          padding: '24px',
          borderRadius: '20px',
          margin: '0 auto 20px auto',
          width: '240px',
          height: '240px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)'
        }}>
          <QRCodeSVG
            value={activeWallet.address}
            size={192}
            level="H"
            includeMargin={false}
          />
        </div>

        {/* Address Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '12px 16px',
          marginBottom: '16px'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Alamat Wallet Anda ({activeWallet.name}):
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            wordBreak: 'break-all',
            color: 'var(--text-primary)',
            lineHeight: 1.4
          }}>
            {activeWallet.address}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleCopy}
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', marginBottom: '16px', borderRadius: '12px' }}
        >
          {copied ? <Check size={18} /> : <Copy size={18} />}
          <span>{copied ? 'Tersalin ke Clipboard!' : 'Salin Alamat Wallet'}</span>
        </button>

        {/* EVM Compatibility notice */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '12px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          fontSize: '0.75rem',
          color: '#fcd34d'
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Alamat ini kompatibel dengan semua jaringan EVM (ETH, BSC, MTT, dll). Pastikan pengirim mengirim ke jaringan <strong>{network.name}</strong> agar saldo masuk di jaringan ini.
          </span>
        </div>
      </div>
    </div>
  );
};
