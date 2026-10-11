import { ethers } from 'ethers';

/**
 * Generate a new random Ethereum / EVM compatible wallet
 */
export const createNewWallet = (name = 'Akun Utama') => {
  const wallet = ethers.Wallet.createRandom();
  return {
    id: 'wallet_' + Date.now(),
    name: name.trim() || 'Wallet Baru',
    address: wallet.address,
    mnemonic: wallet.mnemonic ? wallet.mnemonic.phrase : null,
    privateKey: wallet.privateKey,
    createdAt: Date.now()
  };
};

/**
 * Import an existing wallet using 12 or 24 words mnemonic phrase
 */
export const importWalletFromMnemonic = (mnemonicPhrase, name = 'Akun Import') => {
  const cleanPhrase = mnemonicPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
  const words = cleanPhrase.split(' ');
  if (words.length !== 12 && words.length !== 24) {
    throw new Error('Seed phrase harus terdiri dari 12 atau 24 kata.');
  }

  try {
    const wallet = ethers.Wallet.fromPhrase(cleanPhrase);
    return {
      id: 'wallet_' + Date.now(),
      name: name.trim() || 'Akun Mnemonic',
      address: wallet.address,
      mnemonic: cleanPhrase,
      privateKey: wallet.privateKey,
      createdAt: Date.now()
    };
  } catch (err) {
    throw new Error('Seed phrase tidak valid: ' + (err.message || 'Format salah'));
  }
};

/**
 * Import an existing wallet using Private Key
 */
export const importWalletFromPrivateKey = (privateKeyInput, name = 'Akun Private Key') => {
  let cleanKey = privateKeyInput.trim();
  if (!cleanKey.startsWith('0x')) {
    cleanKey = '0x' + cleanKey;
  }

  if (cleanKey.length !== 66) {
    throw new Error('Private key harus 64 karakter hexadecimal (atau 66 dengan prefix 0x).');
  }

  try {
    const wallet = new ethers.Wallet(cleanKey);
    return {
      id: 'wallet_' + Date.now(),
      name: name.trim() || 'Akun Private Key',
      address: wallet.address,
      mnemonic: null,
      privateKey: wallet.privateKey,
      isWatchOnly: false,
      createdAt: Date.now()
    };
  } catch (err) {
    throw new Error('Private key tidak valid: ' + (err.message || 'Key rusak'));
  }
};

/**
 * Import a Watch-Only wallet using public address only (for viewing balance & history)
 */
export const importWatchOnlyWallet = (addressInput, name = 'Pantau Alamat') => {
  const cleanAddress = addressInput.trim();
  if (!ethers.isAddress(cleanAddress)) {
    throw new Error('Alamat EVM tidak valid (harus 42 karakter diawali 0x).');
  }

  return {
    id: 'wallet_' + Date.now(),
    name: name.trim() || 'Pantau Alamat',
    address: ethers.getAddress(cleanAddress),
    mnemonic: null,
    privateKey: null,
    isWatchOnly: true,
    createdAt: Date.now()
  };
};

/**
 * Validate EVM address
 */
export const validateAddress = (address) => {
  if (!address || typeof address !== 'string') return false;
  return ethers.isAddress(address.trim());
};

/**
 * Generate multiple EVM wallets at once (HD Mnemonic derivation or Random)
 */
export const bulkGenerateWallets = (count = 10, mode = 'hd', options = {}) => {
  const safeCount = Math.max(1, Math.min(500, parseInt(count, 10) || 10));
  const prefix = options.prefix?.trim() || (mode === 'hd' ? 'HD Wallet' : 'Random Wallet');
  const now = Date.now();

  if (mode === 'hd') {
    let mnemonicPhrase = options.customMnemonic?.trim()?.toLowerCase()?.replace(/\s+/g, ' ');
    if (mnemonicPhrase) {
      const words = mnemonicPhrase.split(' ');
      if (words.length !== 12 && words.length !== 24) {
        throw new Error('Seed phrase kustom harus terdiri dari 12 atau 24 kata.');
      }
    } else {
      mnemonicPhrase = ethers.Wallet.createRandom().mnemonic.phrase;
    }

    const root = ethers.HDNodeWallet.fromPhrase(mnemonicPhrase, undefined, "m/44'/60'/0'/0");
    const wallets = [];

    for (let i = 0; i < safeCount; i++) {
      const child = root.deriveChild(i);
      wallets.push({
        id: `bulk_${now}_${i}`,
        index: i,
        name: `${prefix} #${i + 1}`,
        address: child.address,
        privateKey: child.privateKey,
        path: `m/44'/60'/0'/0/${i}`,
        mnemonic: mnemonicPhrase,
        isWatchOnly: false,
        createdAt: now
      });
    }

    return {
      mode: 'hd',
      mnemonic: mnemonicPhrase,
      wallets
    };
  }

  // Random mode: each wallet is completely independent
  const wallets = [];
  for (let i = 0; i < safeCount; i++) {
    const w = ethers.Wallet.createRandom();
    wallets.push({
      id: `bulk_${now}_${i}`,
      index: i,
      name: `${prefix} #${i + 1}`,
      address: w.address,
      privateKey: w.privateKey,
      path: null,
      mnemonic: w.mnemonic ? w.mnemonic.phrase : null,
      isWatchOnly: false,
      createdAt: now
    });
  }

  return {
    mode: 'random',
    mnemonic: null,
    wallets
  };
};

/**
 * Parse bulk text input (Private keys, addresses, or CSV format)
 */
export const parseBulkInput = (rawText, defaultPrefix = 'Import') => {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results = [];
  const now = Date.now();
  let index = 0;

  for (const line of lines) {
    // Check if line contains CSV delimiters like comma or tab or pipe
    const parts = line.split(/[,;\t|]+/).map((p) => p.trim().replace(/^["']|["']$/g, ''));

    // Check if any part is a private key
    let foundPk = null;
    let foundAddr = null;
    let foundMnemonic = null;

    for (const part of parts) {
      const clean = part.trim();
      const words = clean.toLowerCase().split(/\s+/);
      if ((words.length === 12 || words.length === 24) && words.every((w) => w.length > 1)) {
        foundMnemonic = clean.toLowerCase();
        break;
      }

      let hexKey = clean;
      if (!hexKey.startsWith('0x') && (hexKey.length === 64)) {
        hexKey = '0x' + hexKey;
      }

      if (hexKey.startsWith('0x') && hexKey.length === 66 && /^0x[0-9a-fA-F]{64}$/.test(hexKey)) {
        foundPk = hexKey;
      } else if (ethers.isAddress(clean)) {
        foundAddr = ethers.getAddress(clean);
      }
    }

    if (foundPk) {
      try {
        const w = new ethers.Wallet(foundPk);
        index++;
        results.push({
          id: `import_${now}_${index}`,
          name: `${defaultPrefix} #${index}`,
          address: w.address,
          privateKey: w.privateKey,
          mnemonic: null,
          isWatchOnly: false,
          createdAt: now
        });
        continue;
      } catch (e) {
        // invalid pk
      }
    }

    if (foundMnemonic) {
      try {
        const w = ethers.Wallet.fromPhrase(foundMnemonic);
        index++;
        results.push({
          id: `import_${now}_${index}`,
          name: `${defaultPrefix} Mnemonic #${index}`,
          address: w.address,
          privateKey: w.privateKey,
          mnemonic: foundMnemonic,
          isWatchOnly: false,
          createdAt: now
        });
        continue;
      } catch (e) {
        // invalid phrase
      }
    }

    if (foundAddr) {
      index++;
      results.push({
        id: `import_${now}_${index}`,
        name: `${defaultPrefix} Pantau #${index}`,
        address: foundAddr,
        privateKey: null,
        mnemonic: null,
        isWatchOnly: true,
        createdAt: now
      });
    }
  }

  return results;
};

/**
 * Format address to short readable string e.g. 0x1234...5678
 */
export const formatAddress = (address, start = 6, end = 4) => {
  if (!address) return '';
  return `${address.substring(0, start)}...${address.substring(address.length - end)}`;
};

/**
 * Create an ethers Provider for a network
 */
export const getProvider = (network) => {
  if (!network || !network.rpcUrl) {
    throw new Error('RPC URL tidak ditemukan untuk jaringan ini');
  }
  return new ethers.JsonRpcProvider(network.rpcUrl, undefined, {
    staticNetwork: network.chainId ? ethers.Network.from(network.chainId) : undefined
  });
};

/**
 * Create an ethers Signer for transactions
 */
export const getSigner = (privateKey, network) => {
  const provider = getProvider(network);
  return new ethers.Wallet(privateKey, provider);
};

/**
 * Calculate maximum sendable native amount minus standard gas fee
 */
export const calculateMaxNativeSendable = async (balanceStr, network) => {
  try {
    const provider = getProvider(network);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('12', 'gwei');
    const gasLimit = 21000n;
    // 10% safety buffer for gas fluctuation
    const gasCostWei = (gasLimit * gasPrice * 110n) / 100n;
    const balanceWei = ethers.parseEther(balanceStr || '0');

    if (balanceWei <= gasCostWei) {
      return {
        maxAmount: '0.0',
        estimatedFee: ethers.formatEther(gasCostWei),
        canSend: false
      };
    }

    const sendableWei = balanceWei - gasCostWei;
    return {
      maxAmount: ethers.formatEther(sendableWei),
      estimatedFee: ethers.formatEther(gasCostWei),
      canSend: true
    };
  } catch (err) {
    console.error('Error calculating max sendable:', err);
    return {
      maxAmount: '0.0',
      estimatedFee: '0.0003',
      canSend: false
    };
  }
};

/**
 * Send native coin directly from private key
 */
export const sendNativeTransferFromPk = async ({
  privateKey,
  toAddress,
  amount,
  network
}) => {
  const provider = getProvider(network);
  const signer = new ethers.Wallet(privateKey, provider);
  const parsedValue = ethers.parseEther(amount.toString());

  const tx = await signer.sendTransaction({
    to: toAddress,
    value: parsedValue
  });

  return tx;
};


