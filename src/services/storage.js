const STORAGE_KEYS = {
  WALLETS: 'cryptowallet_wallets',
  ACTIVE_WALLET: 'cryptowallet_active_wallet',
  NETWORKS: 'cryptowallet_networks',
  ACTIVE_NETWORK: 'cryptowallet_active_network',
  TOKENS: 'cryptowallet_tokens',
  LOCAL_TXS: 'cryptowallet_local_txs'
};

export const getStoredWallets = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WALLETS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Error reading stored wallets', e);
    return [];
  }
};

export const saveWallets = (wallets) => {
  try {
    localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets));
  } catch (e) {
    console.error('Error saving wallets', e);
  }
};

export const getActiveWalletAddress = () => {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_WALLET) || null;
};

export const setActiveWalletAddress = (address) => {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_WALLET, address);
};

export const getStoredNetworks = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.NETWORKS);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error('Error reading stored networks', e);
    return null;
  }
};

export const saveNetworks = (networks) => {
  try {
    localStorage.setItem(STORAGE_KEYS.NETWORKS, JSON.stringify(networks));
  } catch (e) {
    console.error('Error saving networks', e);
  }
};

export const getActiveNetworkId = () => {
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_NETWORK) || 'mtt-network';
};

export const setActiveNetworkId = (networkId) => {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_NETWORK, networkId);
};

export const getStoredTokens = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TOKENS);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('Error reading tokens', e);
    return {};
  }
};

export const saveTokens = (tokensMap) => {
  try {
    localStorage.setItem(STORAGE_KEYS.TOKENS, JSON.stringify(tokensMap));
  } catch (e) {
    console.error('Error saving tokens', e);
  }
};

export const getStoredLocalTxs = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOCAL_TXS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const addLocalTx = (tx) => {
  try {
    const txs = getStoredLocalTxs();
    txs.unshift(tx);
    localStorage.setItem(STORAGE_KEYS.LOCAL_TXS, JSON.stringify(txs.slice(0, 50)));
  } catch (e) {
    console.error('Error saving local tx', e);
  }
};
