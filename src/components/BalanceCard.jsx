import React from 'react';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, ExternalLink, Shield } from 'lucide-react';

export const BalanceCard = ({
  balance,
  isLoading,
  network,
  activeWallet,
  onRefresh,
  onOpenSend,
  onOpenReceive
}) => {
  const formattedBalance = parseFloat(balance || '0').toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6
  });

  const explorerAddressUrl = network.explorerUrl && activeWallet?.address
    ? `${network.explorerUrl}/address/${activeWallet.address}`
    : null;

  return (
    <div
      className="glass-panel"
      style={{
        padding: '28px 24px',
        marginBottom: '24px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, rgba(26, 34, 54, 0.85) 0%, rgba(15, 23, 42, 0.75) 100%)'
      }}
    >
      {/* Decorative ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: network.color || '#6366f1',
          filter: 'blur(70px)',
          opacity: 0.15,
          pointerEvents: 'none'
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Saldo Utama ({network.name})
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '6px' }}>
            <span style={{
              fontSize: '2.4rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              fontFamily: 'var(--font-sans)',
              lineHeight: 1.1
            }}>
              {isLoading ? '...' : formattedBalance}
            </span>
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: network.color || 'var(--accent-primary)',
              letterSpacing: '-0.01em'
            }}>
              {network.symbol}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onRefresh}
            className="btn btn-secondary"
            style={{ padding: '8px', borderRadius: '10px' }}
            title="Refresh Saldo & Riwayat"
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
          </button>
          {explorerAddressUrl && (
            <a
              href={explorerAddressUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ padding: '8px', borderRadius: '10px', textDecoration: 'none' }}
              title="Buka di Block Explorer"
            >
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>

      {/* Network metadata pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '0.75rem',
          padding: '4px 10px',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)'
        }}>
          Chain ID: <strong style={{ color: 'var(--text-primary)' }}>{network.chainId}</strong>
        </span>
        {network.isTestnet && (
          <span className="badge badge-testnet">Testnet</span>
        )}
        <span style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Shield size={12} color="#10b981" /> RPC: {new URL(network.rpcUrl || 'http://localhost').hostname}
        </span>
      </div>

      {/* Action buttons (Kirim & Terima) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <button
          onClick={onOpenSend}
          className="btn btn-primary"
          style={{ padding: '14px', fontSize: '1rem', borderRadius: '14px' }}
          disabled={!activeWallet}
        >
          <ArrowUpRight size={20} />
          <span>Kirim Aset</span>
        </button>
        <button
          onClick={onOpenReceive}
          className="btn btn-secondary"
          style={{ padding: '14px', fontSize: '1rem', borderRadius: '14px' }}
          disabled={!activeWallet}
        >
          <ArrowDownLeft size={20} />
          <span>Terima Aset</span>
        </button>
      </div>
    </div>
  );
};
