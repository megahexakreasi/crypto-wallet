import React from 'react';
import { Plus, Coins, Send, ExternalLink, Trash2 } from 'lucide-react';
import { formatAddress } from '../services/wallet';

export const TokenList = ({
  nativeBalance,
  tokens = [],
  network,
  onOpenAddToken,
  onSendToken,
  onRemoveToken,
  isLoading
}) => {
  return (
    <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Coins size={18} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Daftar Aset & Token</h2>
          <span style={{
            fontSize: '0.75rem',
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '2px 8px',
            borderRadius: '10px',
            color: 'var(--text-secondary)'
          }}>
            {tokens.length + 1}
          </span>
        </div>

        <button
          onClick={onOpenAddToken}
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '10px' }}
        >
          <Plus size={14} />
          <span>Tambah Token</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Native Coin item */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            transition: 'background 0.2s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: network.color || '#6366f1',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.85rem'
              }}
            >
              {network.symbol.substring(0, 3)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{network.name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Koin Utama (Native)</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {parseFloat(nativeBalance || '0').toLocaleString('en-US', {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 6
                })}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{network.symbol}</div>
            </div>
            <button
              onClick={() => onSendToken(null)}
              className="btn btn-ghost"
              style={{ padding: '6px 10px', borderRadius: '8px' }}
              title="Kirim Koin Utama"
            >
              <Send size={15} />
            </button>
          </div>
        </div>

        {/* Custom and standard tokens */}
        {tokens.map((token) => (
          <div
            key={token.address}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.8rem'
                }}
              >
                {token.symbol?.substring(0, 4) || 'TOK'}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{token.symbol}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{token.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>({formatAddress(token.address, 4, 3)})</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  {isLoading ? '...' : parseFloat(token.balance || '0').toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6
                  })}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{token.symbol}</div>
              </div>

              <button
                onClick={() => onSendToken(token)}
                className="btn btn-ghost"
                style={{ padding: '6px 10px', borderRadius: '8px' }}
                title={`Kirim ${token.symbol}`}
              >
                <Send size={15} />
              </button>

              {onRemoveToken && (
                <button
                  onClick={() => onRemoveToken(token.address)}
                  className="btn btn-ghost"
                  style={{ padding: '6px 8px', borderRadius: '8px', color: '#f43f5e' }}
                  title="Hapus token dari daftar"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
