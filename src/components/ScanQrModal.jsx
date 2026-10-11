import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Upload, AlertCircle, CheckCircle2, QrCode, RefreshCw } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  validateAddress,
  importWalletFromPrivateKey,
  importWalletFromMnemonic,
  importWatchOnlyWallet
} from '../services/wallet';

export const ScanQrModal = ({
  isOpen,
  onClose,
  onWalletLogin,
  onNotify
}) => {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' or 'file'
  const [errorMsg, setErrorMsg] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const qrRegionId = 'qr-reader-region';
  const html5QrCodeRef = useRef(null);

  // Stop camera helper
  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
      } catch (e) {
        console.warn('Error stopping camera:', e);
      }
    }
    setIsCameraActive(false);
  };

  // Process decoded QR text
  const handleDecodedText = async (decodedText) => {
    let cleanText = decodedText.trim();
    setIsProcessing(true);
    setErrorMsg('');

    // Handle EIP-681 prefix: ethereum:0x... or bsc:0x...
    if (cleanText.toLowerCase().startsWith('ethereum:')) {
      cleanText = cleanText.substring(9).split('?')[0].split('@')[0];
    } else if (cleanText.toLowerCase().startsWith('mtt:')) {
      cleanText = cleanText.substring(4).split('?')[0];
    }

    try {
      // 1. Check if it's an EVM Public Address
      if (validateAddress(cleanText)) {
        await stopCamera();
        const wallet = importWatchOnlyWallet(cleanText, 'Akun Scan QR');
        onWalletLogin(wallet);
        onNotify?.('Berhasil login menggunakan Alamat dari QR Code!', 'success');
        onClose();
        return;
      }

      // 2. Check if it's a Private Key (64 hex or 66 with 0x)
      const rawHex = cleanText.startsWith('0x') ? cleanText.slice(2) : cleanText;
      if (rawHex.length === 64 && /^[0-9a-fA-F]+$/.test(rawHex)) {
        await stopCamera();
        const wallet = importWalletFromPrivateKey(cleanText, 'Akun Scan Private Key');
        onWalletLogin(wallet);
        onNotify?.('Berhasil login & impor wallet dari Private Key QR!', 'success');
        onClose();
        return;
      }

      // 3. Check if it's a Seed Phrase (12 or 24 words)
      const words = cleanText.split(/\s+/);
      if (words.length === 12 || words.length === 24) {
        await stopCamera();
        const wallet = importWalletFromMnemonic(cleanText, 'Akun Scan Mnemonic');
        onWalletLogin(wallet);
        onNotify?.('Berhasil login & impor wallet dari Seed Phrase QR!', 'success');
        onClose();
        return;
      }

      // If format not recognized
      setErrorMsg(`Data QR tidak dikenali: "${cleanText.substring(0, 40)}...". Harap scan QR berisi Alamat EVM (0x...), Private Key, atau Mnemonic.`);
    } catch (err) {
      setErrorMsg(err.message || 'Gagal memproses data QR Code.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Start Camera
  const startCamera = async () => {
    setErrorMsg('');
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(qrRegionId);
      }

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        setErrorMsg('Tidak ada kamera yang ditemukan pada perangkat ini.');
        return;
      }

      // Prefer back camera if available, else first camera
      const backCamera = cameras.find((c) =>
        c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('environment')
      );
      const cameraId = backCamera ? backCamera.id : cameras[0].id;

      await html5QrCodeRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleDecodedText(decodedText);
        },
        () => {
          // scanning frame, ignore error
        }
      );
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera start error:', err);
      setErrorMsg('Gagal mengakses kamera: ' + (err.message || 'Izin kamera ditolak. Silakan gunakan tab Unggah Gambar QR.'));
      setIsCameraActive(false);
    }
  };

  // File Upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setIsProcessing(true);

    try {
      const qrScanner = new Html5Qrcode('file-qr-temp');
      const result = await qrScanner.scanFile(file, true);
      if (result) {
        handleDecodedText(result);
      } else {
        setErrorMsg('Tidak ditemukan QR Code yang valid pada gambar tersebut.');
      }
    } catch (err) {
      setErrorMsg('Gagal membaca gambar QR: ' + (err.message || 'Format tidak didukung atau QR tidak jelas'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Lifecycle when modal opens/closes
  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      const timer = setTimeout(() => {
        startCamera();
      }, 200);
      return () => clearTimeout(timer);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleCloseModal = async () => {
    await stopCamera();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleCloseModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: '24px', maxWidth: '480px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <QrCode size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Scan QR Code Login</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Scan Alamat EVM (0x...), Private Key, atau Mnemonic
              </span>
            </div>
          </div>
          <button onClick={handleCloseModal} className="btn btn-ghost" style={{ padding: '6px', borderRadius: '8px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab options: Kamera vs Unggah File */}
        <div className="tabs-nav" style={{ marginBottom: '16px' }}>
          <button
            className={`tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
            onClick={() => setActiveTab('camera')}
          >
            <Camera size={15} />
            <span>Kamera Langsung</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'file' ? 'active' : ''}`}
            onClick={async () => {
              await stopCamera();
              setActiveTab('file');
            }}
          >
            <Upload size={15} />
            <span>Unggah Gambar QR</span>
          </button>
        </div>

        {/* Content Tab 1: Kamera */}
        {activeTab === 'camera' && (
          <div>
            <div
              style={{
                position: 'relative',
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#040711',
                border: '1px solid var(--border-color)',
                minHeight: '280px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div id={qrRegionId} style={{ width: '100%', height: '100%' }} />

              {!isCameraActive && !errorMsg && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto' }} />
                  <div>Menghubungkan ke kamera...</div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Arahkan kamera ke QR Code alamat wallet, private key, atau seed phrase Anda.
            </div>

            {/* Direct Mobile Native Camera Button */}
            <div style={{ marginTop: '14px' }}>
              <label
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  cursor: 'pointer',
                  border: '1px solid rgba(6, 182, 212, 0.4)',
                  background: 'rgba(6, 182, 212, 0.1)',
                  padding: '10px 14px'
                }}
              >
                <Camera size={18} color="#06b6d4" />
                <span>Buka Kamera HP (Foto QR Langsung)</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '4px' }}>
                Tip untuk HP: Jika video stream dibatasi oleh browser, klik tombol di atas untuk memotret QR Code langsung dengan kamera HP Anda.
              </div>
            </div>
          </div>
        )}

        {/* Content Tab 2: Unggah File */}
        {activeTab === 'file' && (
          <div>
            <div style={{ display: 'none' }} id="file-qr-temp" />
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '2px dashed var(--border-color)',
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'center'
              }}
            >
              <Upload size={36} color="var(--accent-primary)" style={{ marginBottom: '12px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
                Klik untuk Memilih Foto / Screenshot QR
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Mendukung file PNG, JPG, JPEG, WEBP
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}

        {/* Error notification if any */}
        {errorMsg && (
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: '12px',
              padding: '12px 14px',
              marginTop: '16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              color: '#fda4af',
              fontSize: '0.8rem',
              lineHeight: 1.4
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* Processing Spinner */}
        {isProcessing && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '16px',
            color: 'var(--accent-primary)',
            fontSize: '0.85rem',
            fontWeight: 600
          }}>
            <RefreshCw size={16} className="spin" />
            <span>Memproses dan memvalidasi QR Code...</span>
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleCloseModal} className="btn btn-secondary" style={{ width: '100%', padding: '12px' }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
