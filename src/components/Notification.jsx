import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const Notification = ({ notification, onClose }) => {
  if (!notification) return null;

  const { message, type } = notification;

  const bg = type === 'success'
    ? 'rgba(16, 185, 129, 0.95)'
    : type === 'error'
    ? 'rgba(244, 63, 94, 0.95)'
    : 'rgba(99, 102, 241, 0.95)';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background: bg,
        color: '#ffffff',
        padding: '12px 18px',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
        fontSize: '0.875rem',
        fontWeight: 600,
        maxWidth: '400px',
        animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {type === 'success' && <CheckCircle2 size={18} />}
      {type === 'error' && <AlertCircle size={18} />}
      {type === 'info' && <Info size={18} />}
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: '#ffffff',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
};
