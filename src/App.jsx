import React, { useState, useEffect, useCallback } from 'react';
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
    const demoWallet = {
      id: 'wallet_mtt_user',
      name: 'Akun MTT (0xa6b3...)',
      address: '0xa6b3aF2b471C7E1bB110e04b5a897610A86b0824',
      mnemonic: null,
      privateKey: null,
      isWatchOnly: true,
      createdAt: Date.now()
    };

    if (stored.length > 0) {
      if (!stored.some((w) => w.address.toLowerCase() === demoWallet.address.toLowerCase())) {
        const mergedWallets = [demoWallet, ...stored];
        saveWallets(mergedWallets);
        return mergedWallets;
      }
      return stored;
    }

    const initial = createNewWallet('Wallet Lokal');
    const defaultList = [demoWallet, initial];
    saveWallets(defaultList);
    setActiveWalletAddress(demoWallet.address);
    return defaultList;
  });

  const [activeAddress, setActiveAddressState] = useState(() => {
    return getActiveWalletAddress() || '0xa6b3aF2b471C7E1bB110e04b5a897610A86b0824';
  });

  const activeWallet = wallets.find((w) => w.address.toLowerCase() === activeAddress?.toLowerCase()) || wallets[0];

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

  // 6. Toast Notifications
  const [notification, setNotification] = useState(null);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
  }, []);

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

  // Wallet Remove
  const handleRemoveWallet = (id) => {
    const updated = wallets.filter((w) => w.id !== id);
    setWallets(updated);
    saveWallets(updated);
    if (activeWallet.id === id && updated.length > 0) {
      handleSelectWallet(updated[0]);
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

      {/* Conditional View: Bulk Wallet Tools vs Main Wallet Dashboard */}
      {currentPage === 'bulk' || currentPage === 'sweep' ? (
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

      {/* Toast Notification */}
      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />
    </div>
  );
}

export default App;
