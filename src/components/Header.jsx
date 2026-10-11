import React from 'react';
import { Wallet, Copy, Check, ChevronDown, ShieldCheck, QrCode, Layers, Send } from 'lucide-react';
import { formatAddress } from '../services/wallet';

export const Header = ({
  activeWallet,
  activeNetwork,
  currentPage = 'main',
  onPageChange,
  onOpenWalletModal,
  onOpenNetworkModal,
  onOpenScanQr,
  onNotify
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyAddress = (e) => {
    e.stopPropagation();
    if (!activeWallet?.address) return;
    navigator.clipboard.writeText(activeWallet.address);
    setCopied(true);
    onNotify?.('Alamat berhasil disalin ke clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      marginBottom: '24px'
    }}>
      {/* Brand logo & title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)'
        }}>
          <ShieldCheck size={24} color="#ffffff" />
        </div>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Local EVM Wallet
          </h1>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            Non-Custodial &bull; Client-Side
          </span>
        </div>
      </div>

      {/* Center Navigation Switcher */}
      <div style={{
        display: 'flex',
        background: 'rgba(255, 255, 255, 0.04)',
        padding: '4px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        gap: '4px'
      }}>
        <button
          onClick={() => onPageChange?.('main')}
          className={`btn ${currentPage === 'main' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
        >
          <Wallet size={15} />
          <span>Dompet Utama</span>
        </button>
        <button
          onClick={() => onPageChange?.('bulk')}
          className={`btn ${currentPage === 'bulk' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
        >
          <Layers size={15} />
          <span>Bulk Tools</span>
        </button>
        <button
          onClick={() => onPageChange?.('sweep')}
          className={`btn ${currentPage === 'sweep' ? 'btn-primary' : 'btn-ghost'}`}
          style={{
            padding: '6px 14px',
            fontSize: '0.85rem',
            background: currentPage === 'sweep' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
            border: currentPage === 'sweep' ? '1px solid #10b981' : 'transparent',
            color: '#fff'
          }}
        >
          <Send size={15} />
          <span>Kirim Bulk 1-Klik</span>
        </button>
      </div>

      {/* Network, QR Scan & Wallet Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

        {/* Scan QR Button */}
        <button
          onClick={onOpenScanQr}
          className="btn btn-secondary"
          style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          title="Scan QR Code untuk Login / Impor Wallet"
        >
          <QrCode size={16} color="#06b6d4" />
          <span>Scan QR</span>
        </button>

        {/* Network Button */}
        <button
          onClick={onOpenNetworkModal}
          className="btn btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          title="Ganti Jaringan (ETH / BSC / MTT)"
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: activeNetwork.color || '#6366f1',
              boxShadow: `0 0 8px ${activeNetwork.color || '#6366f1'}`
            }}
          />
          <span>{activeNetwork.shortName || activeNetwork.name}</span>
          <ChevronDown size={14} color="var(--text-muted)" />
        </button>

        {/* Wallet Button */}
        {activeWallet ? (
          <div
            onClick={onOpenWalletModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '6px 12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              {activeWallet.name?.substring(0, 1).toUpperCase() || 'W'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.1 }}>{activeWallet.name}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {formatAddress(activeWallet.address, 4, 3)}
              </span>
            </div>
            <button
              onClick={handleCopyAddress}
              style={{
                background: 'transparent',
                border: 'none',
                color: copied ? '#10b981' : 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Salin Alamat"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        ) : (
          <button onClick={onOpenWalletModal} className="btn btn-primary" style={{ padding: '8px 14px' }}>
            <Wallet size={16} />
            <span>Pilih / Buat Wallet</span>
          </button>
        )}
      </div>
    </header>
  );
};
