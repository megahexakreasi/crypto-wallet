import React, { useState } from 'react';
import { X, Globe, Plus, Check, Edit3, Save, Trash2, ShieldAlert } from 'lucide-react';

export const NetworkModal = ({
  isOpen,
  onClose,
  networks = [],
  activeNetwork,
  onSelectNetwork,
  onSaveNetwork,
  onNotify
}) => {
  const [editingNetwork, setEditingNetwork] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formChainId, setFormChainId] = useState('');
  const [formSymbol, setFormSymbol] = useState('');
  const [formRpcUrl, setFormRpcUrl] = useState('');
  const [formExplorerUrl, setFormExplorerUrl] = useState('');
  const [formBlockscoutApi, setFormBlockscoutApi] = useState('');

  if (!isOpen) return null;

  const handleStartEdit = (net) => {
    setEditingNetwork(net);
    setIsAddingNew(false);
    setFormName(net.name);
    setFormChainId(net.chainId.toString());
    setFormSymbol(net.symbol);
    setFormRpcUrl(net.rpcUrl);
    setFormExplorerUrl(net.explorerUrl || '');
    setFormBlockscoutApi(net.blockscoutApi || '');
  };

  const handleStartAdd = () => {
    setEditingNetwork(null);
    setIsAddingNew(true);
    setFormName('');
    setFormChainId('');
    setFormSymbol('ETH');
    setFormRpcUrl('');
    setFormExplorerUrl('');
    setFormBlockscoutApi('');
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!formName || !formRpcUrl || !formChainId) {
      onNotify?.('Nama, Chain ID, dan RPC URL wajib diisi!', 'error');
      return;
    }

    const trimmedRpc = formRpcUrl.trim();
    if (!trimmedRpc.startsWith('https://') && !trimmedRpc.startsWith('http://localhost') && !trimmedRpc.startsWith('http://127.0.0.1')) {
      onNotify?.('Demi keamanan, RPC URL wajib menggunakan protokol HTTPS!', 'error');
      return;
    }

    const updated = {
      id: editingNetwork ? editingNetwork.id : 'custom-' + Date.now(),
      name: formName.trim(),
      shortName: formSymbol.trim(),
      chainId: parseInt(formChainId, 10),
      symbol: formSymbol.trim().toUpperCase(),
      rpcUrl: trimmedRpc,
      explorerUrl: formExplorerUrl.trim(),
      blockscoutApi: formBlockscoutApi.trim(),
      isTestnet: false,
      color: editingNetwork?.color || '#06b6d4'
    };

    onSaveNetwork(updated);
    setEditingNetwork(null);
    setIsAddingNew(false);
    onNotify?.(`Jaringan ${updated.name} berhasil disimpan!`, 'success');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', maxWidth: '520px' }}>
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
              <Globe size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Pilih & Kelola Jaringan</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mendukung EVM & Blockscout API</span>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '6px', borderRadius: '8px' }}>
            <X size={18} />
          </button>
        </div>

        {isAddingNew || editingNetwork ? (
          /* Network Edit / Add Form */
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
              {isAddingNew ? 'Tambah Jaringan EVM Baru' : `Edit Pengaturan ${editingNetwork.name}`}
            </h4>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Nama Jaringan
              </label>
              <input
                type="text"
                placeholder="Contoh: MTT Mainnet"
                className="input-field"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Chain ID
                </label>
                <input
                  type="number"
                  placeholder="Contoh: 56 atau 1"
                  className="input-field"
                  value={formChainId}
                  onChange={(e) => setFormChainId(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Simbol Koin
                </label>
                <input
                  type="text"
                  placeholder="Contoh: MTT / BNB"
                  className="input-field"
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                RPC URL Node
              </label>
              <input
                type="url"
                placeholder="https://..."
                className="input-field input-mono"
                value={formRpcUrl}
                onChange={(e) => setFormRpcUrl(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Blockscout Explorer URL
              </label>
              <input
                type="url"
                placeholder="https://explorer.mttnetwork.com"
                className="input-field input-mono"
                value={formExplorerUrl}
                onChange={(e) => setFormExplorerUrl(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Blockscout API Endpoint (docs.blockscout.com/devs/apis/rpc)
              </label>
              <input
                type="url"
                placeholder="https://explorer.mttnetwork.com/api"
                className="input-field input-mono"
                value={formBlockscoutApi}
                onChange={(e) => setFormBlockscoutApi(e.target.value)}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Digunakan untuk cek riwayat keluar & masuk otomatis (txlist & tokentx).
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => { setEditingNetwork(null); setIsAddingNew(false); }}
                className="btn btn-secondary"
              >
                Batal
              </button>
              <button type="submit" className="btn btn-primary">
                <Save size={16} />
                <span>Simpan Jaringan</span>
              </button>
            </div>
          </form>
        ) : (
          /* Network List */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {networks.map((net) => {
              const isActive = activeNetwork.id === net.id;
              return (
                <div
                  key={net.id}
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
                  onClick={() => {
                    onSelectNetwork(net);
                    onClose();
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: net.color || '#6366f1',
                        boxShadow: `0 0 10px ${net.color || '#6366f1'}`
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{net.name}</span>
                        {net.isTestnet && <span className="badge badge-testnet" style={{ fontSize: '0.65rem' }}>Testnet</span>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Chain ID: {net.chainId} &bull; Symbol: {net.symbol}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleStartEdit(net)}
                      className="btn btn-ghost"
                      style={{ padding: '6px', borderRadius: '8px' }}
                      title="Edit RPC & Blockscout API"
                    >
                      <Edit3 size={15} />
                    </button>
                    {isActive && (
                      <span style={{ color: 'var(--accent-primary)', padding: '6px' }}>
                        <Check size={18} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              onClick={handleStartAdd}
              className="btn btn-secondary"
              style={{ marginTop: '8px', width: '100%', padding: '12px' }}
            >
              <Plus size={16} />
              <span>Tambah Jaringan Kustom</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
