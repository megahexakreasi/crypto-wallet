import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Lock, X, Delete, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { verifyStoredPin, setStoredPin } from '../services/security';

export const PinModal = ({
  isOpen,
  mode = 'verify', // 'verify' | 'setup'
  title,
  subtitle,
  onSuccess,
  onCancel
}) => {
  // Input digits buffer
  const [pin, setPin] = useState('');
  
  // Setup mode 2-step tracking: 'enter' (first 6 digits) -> 'confirm' (second 6 digits)
  const [setupStep, setSetupStep] = useState('enter');
  const [firstPin, setFirstPin] = useState('');

  // Status & Errors
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setSetupStep('enter');
      setFirstPin('');
      setError('');
      setIsShaking(false);
      setIsProcessing(false);
    }
  }, [isOpen, mode]);

  // Handle digit append
  const handleDigit = useCallback((digit) => {
    if (isProcessing) return;
    setError('');
    setPin((prev) => {
      if (prev.length >= 6) return prev;
      return prev + digit.toString();
    });
  }, [isProcessing]);

  // Handle backspace / delete
  const handleDelete = useCallback(() => {
    if (isProcessing) return;
    setError('');
    setPin((prev) => prev.slice(0, -1));
  }, [isProcessing]);

  // Handle clear
  const handleClear = useCallback(() => {
    if (isProcessing) return;
    setError('');
    setPin('');
  }, [isProcessing]);

  // Physical keyboard listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigit, handleDelete, onCancel]);

  // Trigger shake effect on error
  const triggerShake = (msg) => {
    setError(msg);
    setIsShaking(true);
    setPin('');
    setTimeout(() => setIsShaking(false), 600);
  };

  // Evaluate PIN when 6 digits are reached
  useEffect(() => {
    if (pin.length !== 6) return;

    let isSubscribed = true;

    const processPin = async () => {
      setIsProcessing(true);

      if (mode === 'verify') {
        const isValid = await verifyStoredPin(pin);
        if (!isSubscribed) return;

        if (isValid) {
          setIsProcessing(false);
          onSuccess?.(pin);
        } else {
          setIsProcessing(false);
          triggerShake('PIN yang Anda masukkan salah. Coba lagi.');
        }
      } else if (mode === 'setup') {
        if (setupStep === 'enter') {
          // Move to confirm step
          setFirstPin(pin);
          setPin('');
          setSetupStep('confirm');
          setIsProcessing(false);
        } else if (setupStep === 'confirm') {
          // Check if confirmation matches
          if (pin === firstPin) {
            try {
              await setStoredPin(pin);
              if (!isSubscribed) return;
              setIsProcessing(false);
              onSuccess?.(pin);
            } catch (err) {
              if (!isSubscribed) return;
              setIsProcessing(false);
              triggerShake(err.message || 'Gagal menyimpan PIN.');
            }
          } else {
            setIsProcessing(false);
            triggerShake('PIN konfirmasi tidak sama. Silakan ulangi.');
            setSetupStep('enter');
            setFirstPin('');
          }
        }
      }
    };

    const timer = setTimeout(processPin, 150);
    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [pin, mode, setupStep, firstPin, onSuccess]);

  if (!isOpen) return null;

  // Determine headers
  let displayTitle = title;
  let displaySubtitle = subtitle;

  if (mode === 'verify') {
    displayTitle = displayTitle || 'Masukkan PIN Keamanan';
    displaySubtitle = displaySubtitle || 'Masukkan 6 digit PIN untuk membuka kunci dan otorisasi.';
  } else if (mode === 'setup') {
    if (setupStep === 'enter') {
      displayTitle = displayTitle || 'Buat PIN Keamanan';
      displaySubtitle = displaySubtitle || 'Buat 6 digit PIN untuk mengamankan data dan transaksi Anda.';
    } else {
      displayTitle = 'Konfirmasi PIN Anda';
      displaySubtitle = 'Ketik ulang 6 digit PIN tadi untuk memastikan tidak salah ketik.';
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '380px',
          width: '92%',
          padding: '28px 24px 24px 24px',
          borderRadius: '24px',
          background: 'linear-gradient(180deg, #1e2238 0%, #111827 100%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.15)',
          textAlign: 'center',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="btn btn-ghost"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            padding: '6px',
            borderRadius: '50%',
            color: 'var(--text-muted)'
          }}
          title="Tutup"
        >
          <X size={18} />
        </button>

        {/* Icon Header */}
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '18px',
          background: mode === 'setup'
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)'
            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
          border: mode === 'setup'
            ? '1px solid rgba(16, 185, 129, 0.4)'
            : '1px solid rgba(99, 102, 241, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          color: mode === 'setup' ? '#34d399' : '#818cf8',
          boxShadow: mode === 'setup'
            ? '0 0 20px rgba(16, 185, 129, 0.25)'
            : '0 0 20px rgba(99, 102, 241, 0.25)'
        }}>
          {mode === 'setup' ? <KeyRound size={26} /> : <Shield size={26} />}
        </div>

        {/* Title & Subtitle */}
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: '6px'
        }}>
          {displayTitle}
        </h3>
        <p style={{
          fontSize: '0.825rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.45,
          marginBottom: '24px'
        }}>
          {displaySubtitle}
        </p>

        {/* 6 PIN Dot Indicators with Shake on Error */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '20px',
            transform: isShaking ? 'translateX(-8px)' : 'none',
            transition: 'transform 0.08s ease'
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: isFilled
                    ? (mode === 'setup' ? '#10b981' : '#6366f1')
                    : 'rgba(255, 255, 255, 0.12)',
                  border: isFilled
                    ? `2px solid ${mode === 'setup' ? '#34d399' : '#818cf8'}`
                    : '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: isFilled
                    ? `0 0 12px ${mode === 'setup' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(99, 102, 241, 0.6)'}`
                    : 'none',
                  transform: isFilled ? 'scale(1.15)' : 'scale(1)'
                }}
              />
            );
          })}
        </div>

        {/* Error Feedback */}
        {error ? (
          <div style={{
            fontSize: '0.78rem',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            minHeight: '22px',
            marginBottom: '16px'
          }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        ) : (
          <div style={{ minHeight: '22px', marginBottom: '16px' }}>
            {mode === 'setup' && setupStep === 'confirm' && (
              <span style={{ fontSize: '0.78rem', color: '#6ee7b7' }}>
                Langkah 2 dari 2: Ketik ulang PIN yang sama
              </span>
            )}
          </div>
        )}

        {/* Keypad Grid (1-9, C, 0, Backspace) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          maxWidth: '280px',
          margin: '0 auto 10px auto'
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              disabled={isProcessing}
              style={{
                height: '56px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                fontSize: '1.35rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                userSelect: 'none'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.92)';
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)';
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              {num}
            </button>
          ))}

          {/* Clear button */}
          <button
            type="button"
            onClick={handleClear}
            disabled={isProcessing || pin.length === 0}
            style={{
              height: '56px',
              borderRadius: '16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: pin.length === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pin.length === 0 ? 0.3 : 1
            }}
          >
            HAPUS
          </button>

          {/* Zero button */}
          <button
            type="button"
            onClick={() => handleDigit(0)}
            disabled={isProcessing}
            style={{
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              fontSize: '1.35rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              userSelect: 'none'
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'scale(0.92)';
              e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            0
          </button>

          {/* Backspace button */}
          <button
            type="button"
            onClick={handleDelete}
            disabled={isProcessing || pin.length === 0}
            style={{
              height: '56px',
              borderRadius: '16px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: pin.length === 0 ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pin.length === 0 ? 0.3 : 1
            }}
          >
            <Delete size={22} />
          </button>
        </div>

        {/* Security badge note */}
        <div style={{
          marginTop: '16px',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px'
        }}>
          <Lock size={12} color="#10b981" />
          <span>Terenkripsi Web Crypto API PBKDF2 & AES-256 GCM</span>
        </div>
      </div>
    </div>
  );
};
