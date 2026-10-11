import React, { useState } from 'react';
import { History, ArrowDownLeft, ArrowUpRight, ExternalLink, RefreshCw, AlertCircle, Copy, Check } from 'lucide-react';
import { formatAddress } from '../services/wallet';

export const TransactionHistory = ({
  transactions = [],
  tokenTransfers = [],
  network,
  activeWallet,
  isLoading,
  onRefresh
}) => {
  const [filter, setFilter] = useState('all'); // 'all', 'in', 'out', 'token'
  const [copiedHash, setCopiedHash] = useState(null);

  // Combine and sort all transactions
  const combinedList = React.useMemo(() => {
    let list = [];
    if (filter === 'token') {
      list = [...tokenTransfers];
    } else {
      list = [...transactions, ...tokenTransfers];
      // remove duplicates by hash if any
      const seen = new Set();
      list = list.filter((item) => {
        const key = item.hash + (item.type || '') + (item.symbol || '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    if (filter === 'in') {
      list = list.filter((tx) => !tx.isOutgoing);
    } else if (filter === 'out') {
      list = list.filter((tx) => tx.isOutgoing);
    }

    // Sort by timestamp descending
    return list.sort((a, b) => (b.timeStamp || 0) - (a.timeStamp || 0));
  }, [transactions, tokenTransfers, filter]);

  const handleCopyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const formatDate = (ts) => {
    if (!ts) return '-';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <History size={18} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Riwayat Transaksi</h2>
          <span style={{
            fontSize: '0.75rem',
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '2px 8px',
            borderRadius: '10px',
            color: 'var(--text-secondary)'
          }}>
            {combinedList.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onRefresh}
            className="btn btn-ghost"
            style={{ padding: '6px 10px', fontSize: '0.8rem' }}
            disabled={isLoading}
            title="Refresh riwayat transaksi dari Blockscout"
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="tabs-nav" style={{ marginBottom: '16px' }}>
        <button
          className={`tab-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Semua
        </button>
        <button
          className={`tab-btn ${filter === 'in' ? 'active' : ''}`}
          onClick={() => setFilter('in')}
        >
          Masuk (In)
        </button>
        <button
          className={`tab-btn ${filter === 'out' ? 'active' : ''}`}
          onClick={() => setFilter('out')}
        >
          Keluar (Out)
        </button>
        <button
          className={`tab-btn ${filter === 'token' ? 'active' : ''}`}
          onClick={() => setFilter('token')}
        >
          Token
        </button>
      </div>

      {/* Transaction List */}
      {isLoading && combinedList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px auto' }} />
          <div>Memuat riwayat transaksi dari Blockscout API...</div>
        </div>
      ) : combinedList.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 16px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '16px',
          border: '1px dashed var(--border-color)'
        }}>
          <History size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px auto', opacity: 0.6 }} />
          <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Belum Ada Transaksi
          </div>
          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto' }}>
            Transaksi masuk dan keluar pada jaringan {network.name} akan otomatis tercatat di sini menggunakan Blockscout API.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {combinedList.map((tx, idx) => {
            const isOut = tx.isOutgoing;
            const explorerTxUrl = network.explorerUrl ? `${network.explorerUrl}/tx/${tx.hash}` : null;
            const isCopied = copiedHash === tx.hash;

            return (
              <div
                key={tx.hash + '-' + idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '14px',
                  border: '1px solid var(--border-color)',
                  transition: 'background 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* In/Out Icon */}
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: isOut ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                      border: `1px solid ${isOut ? 'rgba(244, 63, 94, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isOut ? '#fb7185' : '#34d399'
                    }}
                  >
                    {isOut ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                  </div>

                  {/* Transaction info */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.925rem' }}>
                        {isOut ? 'Kirim' : 'Terima'} {tx.symbol || network.symbol}
                      </span>
                      {tx.type === 'token' && (
                        <span style={{
                          fontSize: '0.65rem',
                          background: 'rgba(99, 102, 241, 0.15)',
                          color: '#818cf8',
                          padding: '1px 6px',
                          borderRadius: '6px',
                          fontWeight: 600
                        }}>
                          Token
                        </span>
                      )}
                      {tx.type === 'internal' && (
                        <span style={{
                          fontSize: '0.65rem',
                          background: 'rgba(6, 182, 212, 0.15)',
                          color: '#22d3ee',
                          padding: '1px 6px',
                          borderRadius: '6px',
                          fontWeight: 600
                        }}>
                          Internal
                        </span>
                      )}
                      {tx.isError && (
                        <span style={{
                          fontSize: '0.65rem',
                          background: 'rgba(244, 63, 94, 0.15)',
                          color: '#f43f5e',
                          padding: '1px 6px',
                          borderRadius: '6px',
                          fontWeight: 600
                        }}>
                          Gagal
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '2px'
                    }}>
                      <span>{formatDate(tx.timeStamp)}</span>
                      <span>&bull;</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>
                        {isOut ? `Ke: ${formatAddress(tx.to, 5, 4)}` : `Dari: ${formatAddress(tx.from, 5, 4)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Amount & Hash Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      color: isOut ? '#fb7185' : '#34d399'
                    }}>
                      {isOut ? '-' : '+'}{parseFloat(tx.value || '0').toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6
                      })}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {tx.symbol}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button
                      onClick={() => handleCopyHash(tx.hash)}
                      className="btn btn-ghost"
                      style={{ padding: '6px', borderRadius: '8px' }}
                      title="Salin Tx Hash"
                    >
                      {isCopied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                    </button>
                    {explorerTxUrl && (
                      <a
                        href={explorerTxUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost"
                        style={{ padding: '6px', borderRadius: '8px', color: 'var(--text-secondary)' }}
                        title="Lihat di Blockscout"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
