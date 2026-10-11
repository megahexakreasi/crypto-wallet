import React, { useState, useEffect, useCallback } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Header } from './components/Header';
import { BalanceCard } from './components/BalanceCard';
import { TokenList } from './components/TokenList';
import { StatementHistory } from './components/StatementHistory';
import { SendModal } from './components/SendModal';
import { ReceiveModal } from './components/ReceiveModal';
import { AddTokenModal } from './components/AddTokenModal';
import { NetworkModal } from './components/NetworkModal';
import { WalletModal } from './components/WalletModal';
import { ScanQrModal } from './components/ScanQrModal';
import { Notification } from './components/Notification';
import { BulkWalletPage } from './components/BulkWalletPage';
import { OnboardingView } from './components/OnboardingView';
import { PinModal } from './components/PinModal';

import { DEFAULT_NETWORKS, DEFAULT_TOKENS } from './constants/networks';
import {
  getStoredWallets,
  saveWallets,
  getActiveWalletAddress,
  setActiveWalletAddress,
  getStoredNetworks,
  saveNetworks,
  getActiveNetworkId,
  setActiveNetworkId,
  getStoredTokens,
  saveTokens,
  addLocalTx,
  getStoredLocalTxs
} from './services/storage';
import { createNewWallet } from './services/wallet';
import { fetchNativeBalance, fetchTransactionHistory, fetchTokenTransferHistory, fetchInternalTransactionHistory } from './services/blockscout';
import { fetchTokenBalance } from './services/tokens';
import { hasPinConfigured, encryptWalletsList } from './services/security';

export function App() {
  // Navigation View: 'main' (Single Wallet Dashboard) or 'bulk' (Bulk Tools)
  const [currentPage, setCurrentPage] = useState('main');

  // 1. Networks State
  const [networks, setNetworks] = useState(() => {
    const stored = getStoredNetworks();
    if (!stored) return DEFAULT_NETWORKS;
    return DEFAULT_NETWORKS.map((def) => {
      const existing = stored.find((s) => s.id === def.id);
      if (!existing) return def;
      if (def.id === 'mtt-network' && (existing.chainId === 19890 || !existing.rpcUrl?.includes('evm-rpc.mtt.network'))) {
        return def;
      }
      return existing;
    }).concat(stored.filter((s) => !DEFAULT_NETWORKS.some((def) => def.id === s.id)));
  });

  const [activeNetworkId, setActiveNetworkIdState] = useState(() => {
    return getActiveNetworkId();
  });

  const activeNetwork = networks.find((n) => n.id === activeNetworkId) || networks[0];

  // 2. Wallets State
  const [wallets, setWallets] = useState(() => {
    const stored = getStoredWallets();
    // Filter out the legacy demo wallet if present
    const filtered = (stored || []).filter((w) => w.id !== 'wallet_mtt_user');
    if (stored && filtered.length !== stored.length) {
      saveWallets(filtered);
    }
    return filtered;
  });

  const [activeAddress, setActiveAddressState] = useState(() => {
    const current = getActiveWalletAddress();
    if (current && current.toLowerCase() === '0xa6b3af2b471c7e1bb110e04b5a897610a86b0824') {
      setActiveWalletAddress('');
      return null;
    }
    return current || null;
  });

  const activeWallet = wallets.find((w) => w.address?.toLowerCase() === activeAddress?.toLowerCase()) || wallets[0] || null;

  // 3. Tokens State
  const [tokensMap, setTokensMap] = useState(() => {
    const stored = getStoredTokens();
    if (!stored || Object.keys(stored).length === 0) return DEFAULT_TOKENS;
    const merged = { ...stored };
    for (const [netId, defTokens] of Object.entries(DEFAULT_TOKENS)) {
      if (netId === 'mtt-network') {
        merged[netId] = DEFAULT_TOKENS['mtt-network'];
      } else {
        const currentList = merged[netId] || [];
        const updatedList = [...currentList];
        for (const t of defTokens) {
          if (!updatedList.some((item) => item.address.toLowerCase() === t.address.toLowerCase())) {
            updatedList.push(t);
          }
        }
        merged[netId] = updatedList;
      }
    }
    return merged;
  });

  const activeNetworkTokens = tokensMap[activeNetwork.id] || [];

  // 4. Balances & Transactions State
  const [nativeBalance, setNativeBalance] = useState('0.0000');
  const [tokenBalances, setTokenBalances] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [tokenTransfers, setTokenTransfers] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // 5. Modals State
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [networkModalOpen, setNetworkModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [addTokenModalOpen, setAddTokenModalOpen] = useState(false);
  const [scanQrModalOpen, setScanQrModalOpen] = useState(false);
  const [sendInitialToken, setSendInitialToken] = useState(null);
  const [hasPin, setHasPin] = useState(() => hasPinConfigured());
  const [setupPinModalOpen, setSetupPinModalOpen] = useState(false);

  // 6. Toast Notifications
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
  }, []);

  const handleSetupPinSuccess = async (newPin) => {
    setSetupPinModalOpen(false);
    setHasPin(true);
    try {
      const encrypted = await encryptWalletsList(wallets, newPin);
      setWallets(encrypted);
      saveWallets(encrypted);
      showNotification('PIN Keamanan aktif! Semua data dompet Anda berhasil dienkripsi.', 'success');
    } catch (err) {
      console.error('Error encrypting wallets:', err);
      showNotification('PIN tersimpan, namun enkripsi tertunda: ' + err.message, 'warning');
    }
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load balances and transactions whenever wallet or network changes
  const loadWalletData = useCallback(async () => {
    if (!activeWallet || !activeNetwork) return;

    setIsLoadingData(true);
    try {
      // 1. Fetch Native Balance (ETH / BNB / MTT)
      const balancePromise = fetchNativeBalance(activeWallet.address, activeNetwork)
        .then((bal) => setNativeBalance(bal))
        .catch((e) => console.warn('Balance err:', e));

      // 2. Fetch Token Balances
      const tokensPromise = Promise.all(
        activeNetworkTokens.map(async (tok) => {
          const bal = await fetchTokenBalance(
            tok.address,
            activeWallet.address,
            tok.decimals,
            activeNetwork
          );
          return { [tok.address]: bal };
        })
      ).then((resList) => {
        const merged = resList.reduce((acc, curr) => ({ ...acc, ...curr }), {});
        setTokenBalances(merged);
      }).catch((e) => console.warn('Token balances err:', e));

      // 3. Fetch Transaction History via Blockscout API
      const localTxs = getStoredLocalTxs().filter(
        (t) => t.networkId === activeNetwork.id && t.from?.toLowerCase() === activeWallet.address?.toLowerCase()
      );

      const txHistoryPromise = Promise.all([
        fetchTransactionHistory(activeWallet.address, activeNetwork).catch((e) => {
          console.warn('Tx history err:', e);
          return [];
        }),
        fetchInternalTransactionHistory(activeWallet.address, activeNetwork).catch((e) => {
          console.warn('Internal tx err:', e);
          return [];
        })
      ]).then(([remoteTxs, internalTxs]) => {
        // Merge normal + internal transactions, dedup by hash
        const allRemote = [...remoteTxs, ...internalTxs];
        const seen = new Set();
        const deduped = allRemote.filter((t) => {
          const key = t.hash.toLowerCase() + (t.type || '');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        const remoteHashes = new Set(deduped.map((t) => t.hash.toLowerCase()));
        const extraLocal = localTxs.filter((t) => !remoteHashes.has(t.hash.toLowerCase()) && t.type !== 'token');
        setTransactions([...extraLocal, ...deduped]);
      }).catch((e) => {
        console.warn('Tx history err:', e);
        const extraLocal = localTxs.filter((t) => t.type !== 'token');
        setTransactions(extraLocal);
      });

      // 4. Fetch Token Transfers History via Blockscout API
      const tokenTxHistoryPromise = fetchTokenTransferHistory(activeWallet.address, activeNetwork)
        .then((remoteTokenTxs) => {
          const remoteHashes = new Set(remoteTokenTxs.map((t) => t.hash.toLowerCase()));
          const extraLocalTokens = localTxs.filter((t) => !remoteHashes.has(t.hash.toLowerCase()) && t.type === 'token');
          setTokenTransfers([...extraLocalTokens, ...remoteTokenTxs]);
        })
        .catch((e) => {
          console.warn('Token tx err:', e);
          const extraLocalTokens = localTxs.filter((t) => t.type === 'token');
          setTokenTransfers(extraLocalTokens);
        });

      await Promise.allSettled([balancePromise, tokensPromise, txHistoryPromise, tokenTxHistoryPromise]);
    } catch (err) {
      console.error('Error refreshing wallet data:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [activeWallet, activeNetwork, activeNetworkTokens]);

  useEffect(() => {
    loadWalletData();
  }, [loadWalletData]);

  // Network Selection
  const handleSelectNetwork = (net) => {
    setActiveNetworkIdState(net.id);
    setActiveNetworkId(net.id);
    showNotification(`Beralih ke jaringan ${net.name}`, 'info');
  };

  // Network Save / Edit
  const handleSaveNetwork = (updatedNetwork) => {
    const existingIndex = networks.findIndex((n) => n.id === updatedNetwork.id);
    let updatedList;
    if (existingIndex >= 0) {
      updatedList = [...networks];
      updatedList[existingIndex] = updatedNetwork;
    } else {
      updatedList = [...networks, updatedNetwork];
    }
    setNetworks(updatedList);
    saveNetworks(updatedList);
    setActiveNetworkIdState(updatedNetwork.id);
    setActiveNetworkId(updatedNetwork.id);
  };

  // Wallet Selection
  const handleSelectWallet = (w) => {
    setActiveAddressState(w.address);
    setActiveWalletAddress(w.address);
    showNotification(`Aktif: ${w.name}`, 'info');
  };

  // Wallet Add
  const handleAddWallet = (newWallet) => {
    const updated = [...wallets, newWallet];
    setWallets(updated);
    saveWallets(updated);
  };

  // Batch Add Wallets (from Bulk Generator or Bulk Importer)
  const handleAddWalletsBatch = (newWalletsList) => {
    if (!newWalletsList || newWalletsList.length === 0) return;
    const existingSet = new Set(wallets.map((w) => w.address.toLowerCase()));
    const toAdd = newWalletsList.filter((w) => !existingSet.has(w.address.toLowerCase()));
    if (toAdd.length === 0) {
      showNotification('Semua wallet tersebut sudah ada di dalam daftar.', 'info');
      return;
    }
    const updated = [...wallets, ...toAdd];
    setWallets(updated);
    saveWallets(updated);
  };

  // QR Scan Wallet Login
  const handleWalletLogin = (scannedWallet) => {
    const existing = wallets.find(
      (w) => w.address.toLowerCase() === scannedWallet.address.toLowerCase()
    );
    if (existing) {
      handleSelectWallet(existing);
    } else {
      handleAddWallet(scannedWallet);
      handleSelectWallet(scannedWallet);
    }
  };

  // Handle Wallet Created or Imported from Onboarding
  const handleWalletReady = (readyWallet) => {
    const updated = [...wallets, readyWallet];
    setWallets(updated);
    saveWallets(updated);
    setActiveAddressState(readyWallet.address);
    setActiveWalletAddress(readyWallet.address);
    setHasPin(hasPinConfigured());
    showNotification(`Wallet "${readyWallet.name}" berhasil disiapkan & aktif!`, 'success');
  };

  // Wallet Remove
  const handleRemoveWallet = (id) => {
    const updated = wallets.filter((w) => w.id !== id);
    setWallets(updated);
    saveWallets(updated);
    if (activeWallet?.id === id) {
      if (updated.length > 0) {
        handleSelectWallet(updated[0]);
      } else {
        setActiveAddressState(null);
        setActiveWalletAddress('');
      }
    }
    showNotification('Wallet berhasil dihapus.', 'info');
  };

  // Add Custom Token
  const handleAddToken = (newToken) => {
    const currentList = tokensMap[activeNetwork.id] || [];
    // Check duplicate
    if (currentList.some((t) => t.address.toLowerCase() === newToken.address.toLowerCase())) {
      showNotification('Token ini sudah ada di dalam daftar.', 'info');
      return;
    }
    const updated = {
      ...tokensMap,
      [activeNetwork.id]: [...currentList, newToken]
    };
    setTokensMap(updated);
    saveTokens(updated);
    // Reload data to fetch balance immediately
    setTimeout(loadWalletData, 100);
  };

  // Remove Token
  const handleRemoveToken = (contractAddress) => {
    const currentList = tokensMap[activeNetwork.id] || [];
    const updated = {
      ...tokensMap,
      [activeNetwork.id]: currentList.filter(
        (t) => t.address.toLowerCase() !== contractAddress.toLowerCase()
      )
    };
    setTokensMap(updated);
    saveTokens(updated);
    showNotification('Token dihapus dari daftar.', 'info');
  };

  // Trigger Send Modal with pre-selected token
  const handleSendToken = (token) => {
    setSendInitialToken(token);
    setSendModalOpen(true);
  };

  // On Success TX Sent
  const handleSuccessTx = (txData) => {
    addLocalTx({
      ...txData,
      networkId: activeNetwork.id
    });
    // Add to active view list immediately for instant user feedback
    if (txData.type === 'token') {
      setTokenTransfers((prev) => [txData, ...prev]);
    } else {
      setTransactions((prev) => [txData, ...prev]);
    }
    // Refresh balance after 3s
    setTimeout(loadWalletData, 3000);
  };

  // Combine active tokens with their fetched balances
  const enrichedTokens = activeNetworkTokens.map((tok) => ({
    ...tok,
    balance: tokenBalances[tok.address] || '0.0'
  }));

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        activeWallet={activeWallet}
        activeNetwork={activeNetwork}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onOpenWalletModal={() => setWalletModalOpen(true)}
        onOpenNetworkModal={() => setNetworkModalOpen(true)}
        onOpenScanQr={() => setScanQrModalOpen(true)}
        onNotify={showNotification}
      />

      {/* Conditional View: Onboarding (if no wallets) vs Bulk Tools vs Main Dashboard */}
      {wallets.length === 0 ? (
        <OnboardingView
          onWalletReady={handleWalletReady}
          onNotify={showNotification}
          onOpenScanQr={() => setScanQrModalOpen(true)}
        />
      ) : currentPage === 'bulk' || currentPage === 'sweep' ? (
        <BulkWalletPage
          network={activeNetwork}
          networks={networks}
          wallets={wallets}
          initialSubTab={currentPage === 'sweep' ? 'sweep' : 'generator'}
          onAddWalletsBatch={handleAddWalletsBatch}
          onSelectWallet={handleSelectWallet}
          onNotify={showNotification}
          onOpenNetworkModal={() => setNetworkModalOpen(true)}
        />
      ) : (
        <>
          {/* Security Recommendation Banner if PIN not yet configured */}
          {!hasPin && (
            <div style={{
              maxWidth: '680px',
              margin: '0 auto 16px auto',
              padding: '12px 18px',
              borderRadius: '16px',
              background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.14) 0%, rgba(217, 119, 6, 0.08) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              boxShadow: '0 4px 18px rgba(245, 158, 11, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fbbf24',
                  flexShrink: 0
                }}>
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fef3c7' }}>
                    Amankan Dompet dengan 6-Digit PIN
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#fde68a', opacity: 0.9 }}>
                    Enkripsi private key & kunci transaksi Anda dengan standar AES-256 GCM.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSetupPinModalOpen(true)}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  padding: '7px 14px',
                  borderRadius: '10px',
                  border: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(217, 119, 6, 0.35)',
                  cursor: 'pointer'
                }}
              >
                Atur PIN Sekarang
              </button>
            </div>
          )}

          {/* Main Balance Overview */}
          <BalanceCard
            balance={nativeBalance}
            isLoading={isLoadingData}
            network={activeNetwork}
            activeWallet={activeWallet}
            onRefresh={loadWalletData}
            onOpenSend={() => {
              setSendInitialToken(null);
              setSendModalOpen(true);
            }}
            onOpenReceive={() => setReceiveModalOpen(true)}
          />

          {/* Asset & Token List */}
          <TokenList
            nativeBalance={nativeBalance}
            tokens={enrichedTokens}
            network={activeNetwork}
            onOpenAddToken={() => setAddTokenModalOpen(true)}
            onSendToken={handleSendToken}
            onRemoveToken={handleRemoveToken}
            isLoading={isLoadingData}
          />

          {/* Laporan Mutasi — Bank-style Statement (replaces Riwayat Transaksi) */}
          <StatementHistory
            transactions={transactions}
            tokenTransfers={tokenTransfers}
            network={activeNetwork}
            activeWallet={activeWallet}
            nativeBalance={nativeBalance}
            tokens={enrichedTokens}
            isLoading={isLoadingData}
            onRefresh={loadWalletData}
          />
        </>
      )}

      {/* Send Modal */}
      <SendModal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        activeWallet={activeWallet}
        network={activeNetwork}
        nativeBalance={nativeBalance}
        tokens={enrichedTokens}
        initialToken={sendInitialToken}
        onSuccessTx={handleSuccessTx}
        onNotify={showNotification}
      />

      {/* Receive Modal */}
      <ReceiveModal
        isOpen={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        activeWallet={activeWallet}
        network={activeNetwork}
        onNotify={showNotification}
      />

      {/* Add Custom Token Modal */}
      <AddTokenModal
        isOpen={addTokenModalOpen}
        onClose={() => setAddTokenModalOpen(false)}
        network={activeNetwork}
        onAddToken={handleAddToken}
        onNotify={showNotification}
      />

      {/* Network Switcher & Custom RPC / Blockscout Config Modal */}
      <NetworkModal
        isOpen={networkModalOpen}
        onClose={() => setNetworkModalOpen(false)}
        networks={networks}
        activeNetwork={activeNetwork}
        onSelectNetwork={handleSelectNetwork}
        onSaveNetwork={handleSaveNetwork}
        onNotify={showNotification}
      />

      {/* Wallet Management Modal */}
      <WalletModal
        isOpen={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        wallets={wallets}
        activeWallet={activeWallet}
        onSelectWallet={handleSelectWallet}
        onAddWallet={handleAddWallet}
        onRemoveWallet={handleRemoveWallet}
        onOpenScanQr={() => setScanQrModalOpen(true)}
        onNotify={showNotification}
      />

      {/* QR Code Scanner Login Modal */}
      <ScanQrModal
        isOpen={scanQrModalOpen}
        onClose={() => setScanQrModalOpen(false)}
        onWalletLogin={handleWalletLogin}
        onNotify={showNotification}
      />

      {/* Setup PIN Modal for Existing Users */}
      <PinModal
        isOpen={setupPinModalOpen}
        mode="setup"
        title="Buat PIN Keamanan (6 Digit)"
        subtitle="PIN ini akan digunakan untuk mengenkripsi private key & mengunci transaksi di perangkat Anda."
        onSuccess={handleSetupPinSuccess}
        onCancel={() => setSetupPinModalOpen(false)}
      />

      {/* Toast Notification */}
      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />
    </div>
  );
}

export default App;
