import React, { useState } from 'react';
import { X, Plus, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { validateAddress } from '../services/wallet';
import { getTokenDetails } from '../services/tokens';

export const AddTokenModal = ({
  isOpen,
  onClose,
  network,
  onAddToken,
  onNotify
}) => {
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [decimals, setDecimals] = useState('18');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddressChange = async (e) => {
    const val = e.target.value.trim();
    setAddress(val);
    setError('');

    if (validateAddress(val)) {
      setIsLoading(true);
      try {
        const details = await getTokenDetails(val, network);
        setName(details.name);
        setSymbol(details.symbol);
        setDecimals(details.decimals.toString());
      } catch (err) {
        console.warn('Could not auto-fetch token info:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateAddress(address)) {
      setError('Alamat kontrak token tidak valid.');
      return;
    }

    if (!symbol.trim()) {
      setError('Simbol token wajib diisi.');
      return;
    }

    onAddToken({
      address: address.trim(),
      name: name.trim() || symbol.trim(),
      symbol: symbol.trim().toUpperCase(),
      decimals: parseInt(decimals, 10) || 18
    });

    onNotify?.(`Token ${symbol} berhasil ditambahkan!`, 'success');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', maxWidth: '460px' }}>
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
              <Plus size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Tambah Token Custom</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jaringan: {network.name}</span>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px', borderRadius: '8px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Alamat Kontrak Token (Contract Address)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="0x..."
                className="input-field input-mono"
                value={address}
                onChange={handleAddressChange}
                required
              />
              {isLoading && (
                <RefreshCw size={16} className="spin" style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--accent-primary)'
                }} />
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Simbol Token
              </label>
              <input
                type="text"
                placeholder="Contoh: MTT / USDT"
                className="input-field"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Desimal
              </label>
              <input
                type="number"
                placeholder="18"
                className="input-field"
                value={decimals}
                onChange={(e) => setDecimals(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Nama Token (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: My Token Test"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {error && (
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
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={isLoading || !address || !symbol}>
              <Check size={16} />
              <span>Simpan Token</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
