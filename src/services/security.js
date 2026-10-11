/**
 * Security Service - Client-Side Cryptography & PIN Management
 * Uses native Web Crypto API (SubtleCrypto) with PBKDF2 + AES-GCM 256-bit
 */

const PIN_STORAGE_KEY = 'cryptowallet_security_pin';
const SESSION_PIN_KEY = 'cryptowallet_session_pin';
const LOCKOUT_STORAGE_KEY = 'cryptowallet_pin_lockout';
export const MAX_PIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get current PIN lockout status
 */
export const getPinLockoutStatus = () => {
  try {
    const raw = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (!raw) return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    const data = JSON.parse(raw);
    const now = Date.now();
    if (data.lockUntil && data.lockUntil > now) {
      const remainingSeconds = Math.ceil((data.lockUntil - now) / 1000);
      return { isLocked: true, remainingSeconds, attempts: data.attempts || MAX_PIN_ATTEMPTS };
    }
    // Lockout expired, clean up
    if (data.lockUntil && data.lockUntil <= now) {
      localStorage.removeItem(LOCKOUT_STORAGE_KEY);
      return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }
    return { isLocked: false, remainingSeconds: 0, attempts: data.attempts || 0 };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attempts: 0 };
  }
};

/**
 * Record a failed PIN attempt and lock for 5 minutes if 5 failures reached
 */
export const recordFailedPinAttempt = () => {
  try {
    const raw = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    let attempts = 0;
    if (raw) {
      const parsed = JSON.parse(raw);
      attempts = parsed.attempts || 0;
    }
    attempts += 1;

    if (attempts >= MAX_PIN_ATTEMPTS) {
      const lockUntil = Date.now() + LOCKOUT_DURATION_MS;
      localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify({ attempts, lockUntil }));
      return { isLocked: true, remainingSeconds: 300, attempts, remainingAttempts: 0 };
    }

    localStorage.setItem(LOCKOUT_STORAGE_KEY, JSON.stringify({ attempts, lockUntil: null }));
    return { isLocked: false, remainingSeconds: 0, attempts, remainingAttempts: MAX_PIN_ATTEMPTS - attempts };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attempts: 1, remainingAttempts: MAX_PIN_ATTEMPTS - 1 };
  }
};

/**
 * Reset lockout state after successful PIN entry
 */
export const resetPinLockout = () => {
  try {
    localStorage.removeItem(LOCKOUT_STORAGE_KEY);
  } catch {
    // ignore
  }
};

// Helper: Uint8Array <-> Base64
const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const base64ToArrayBuffer = (base64) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// Derive AES-GCM 256 key from PIN and Salt via PBKDF2
const deriveKeyFromPin = async (pin, saltUint8, usages = ['encrypt', 'decrypt']) => {
  const enc = new TextEncoder();
  const pinKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin.toString()),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltUint8,
      iterations: 100000,
      hash: 'SHA-256'
    },
    pinKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usages
  );
};

/**
 * Check if the user has already configured a security PIN
 */
export const hasPinConfigured = () => {
  try {
    return !!localStorage.getItem(PIN_STORAGE_KEY);
  } catch {
    return false;
  }
};

/**
 * Configure and store a new PIN (hashes with PBKDF2 + 16-byte random salt)
 */
export const setStoredPin = async (pin) => {
  if (!pin || pin.length < 4) {
    throw new Error('PIN minimal 4 - 6 digit angka.');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const pinKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin.toString()),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const hashBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    pinKey,
    256
  );

  const payload = {
    salt: arrayBufferToBase64(salt.buffer),
    hash: arrayBufferToBase64(hashBits),
    createdAt: Date.now()
  };

  localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(payload));
  setSessionPin(pin);
  return true;
};

/**
 * Verify whether the entered PIN matches the stored PIN
 */
export const verifyStoredPin = async (pin) => {
  try {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    if (!raw) return true; // If no PIN is configured yet, consider valid
    const data = JSON.parse(raw);
    const saltBuffer = base64ToArrayBuffer(data.salt);

    const enc = new TextEncoder();
    const pinKey = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(pin.toString()),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const hashBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(saltBuffer),
        iterations: 100000,
        hash: 'SHA-256'
      },
      pinKey,
      256
    );

    const calculatedHash = arrayBufferToBase64(hashBits);
    return calculatedHash === data.hash;
  } catch (err) {
    console.error('Error verifying PIN:', err);
    return false;
  }
};

/**
 * Encrypt a text string (such as privateKey or mnemonic) with the user's PIN
 * Returns an encrypted payload object { ct, iv, salt }
 */
export const encryptWithPin = async (plainText, pin) => {
  if (!plainText) return null;
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPin(pin, salt, ['encrypt']);

  const enc = new TextEncoder();
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plainText)
  );

  return {
    ct: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer),
    salt: arrayBufferToBase64(salt.buffer),
    v: 1 // version
  };
};

/**
 * Decrypt an encrypted payload object using the user's PIN
 * Throws an Error if PIN is incorrect or decryption fails
 */
export const decryptWithPin = async (encryptedPayload, pin) => {
  if (!encryptedPayload) return null;
  if (typeof encryptedPayload === 'string') {
    // If it's already plain text (legacy unencrypted wallet)
    return encryptedPayload;
  }

  const { ct, iv, salt } = encryptedPayload;
  const saltBuffer = base64ToArrayBuffer(salt);
  const ivBuffer = base64ToArrayBuffer(iv);
  const ciphertextBuffer = base64ToArrayBuffer(ct);

  const key = await deriveKeyFromPin(pin, new Uint8Array(saltBuffer), ['decrypt']);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
      key,
      ciphertextBuffer
    );
    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    throw new Error('PIN salah atau data korup. Gagal membuka kunci enkripsi.');
  }
};

/**
 * Session PIN handling (stored in sessionStorage for seamless session UX)
 * Cleared automatically upon closing the tab or manually when locked.
 */
export const getSessionPin = () => {
  try {
    return sessionStorage.getItem(SESSION_PIN_KEY) || null;
  } catch {
    return null;
  }
};

export const setSessionPin = (pin) => {
  try {
    sessionStorage.setItem(SESSION_PIN_KEY, pin);
  } catch {
    // ignore
  }
};

export const clearSessionPin = () => {
  try {
    sessionStorage.removeItem(SESSION_PIN_KEY);
  } catch {
    // ignore
  }
};

export const isSessionUnlocked = () => {
  if (!hasPinConfigured()) return true;
  return !!getSessionPin();
};

/**
 * Encrypt a wallet object's sensitive credentials (privateKey, mnemonic)
 */
export const encryptWallet = async (wallet, pin) => {
  if (!wallet || wallet.isWatchOnly) return wallet;

  let encryptedPriv = wallet.privateKey;
  if (typeof wallet.privateKey === 'string' && wallet.privateKey.length > 0) {
    encryptedPriv = await encryptWithPin(wallet.privateKey, pin);
  }

  let encryptedMnemonic = wallet.mnemonic;
  if (typeof wallet.mnemonic === 'string' && wallet.mnemonic.length > 0) {
    encryptedMnemonic = await encryptWithPin(wallet.mnemonic, pin);
  }

  return {
    ...wallet,
    privateKey: encryptedPriv,
    mnemonic: encryptedMnemonic,
    isEncrypted: true
  };
};

/**
 * Decrypt a wallet object's sensitive credentials
 */
export const decryptWallet = async (wallet, pin) => {
  if (!wallet || wallet.isWatchOnly) return wallet;

  let decryptedPriv = wallet.privateKey;
  if (wallet.privateKey && typeof wallet.privateKey === 'object') {
    decryptedPriv = await decryptWithPin(wallet.privateKey, pin);
  }

  let decryptedMnemonic = wallet.mnemonic;
  if (wallet.mnemonic && typeof wallet.mnemonic === 'object') {
    decryptedMnemonic = await decryptWithPin(wallet.mnemonic, pin);
  }

  return {
    ...wallet,
    privateKey: decryptedPriv,
    mnemonic: decryptedMnemonic,
    isEncrypted: false
  };
};

/**
 * Batch encrypt an array of wallets
 */
export const encryptWalletsList = async (wallets, pin) => {
  if (!Array.isArray(wallets)) return [];
  return Promise.all(wallets.map((w) => encryptWallet(w, pin)));
};

/**
 * Batch decrypt an array of wallets
 */
export const decryptWalletsList = async (wallets, pin) => {
  if (!Array.isArray(wallets)) return [];
  return Promise.all(wallets.map((w) => decryptWallet(w, pin)));
};
