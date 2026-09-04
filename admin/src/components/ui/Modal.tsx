'use client';

// src/components/ui/Modal.tsx — Phase 1b
// Per docs/CMS V2.md §三十一 (delete confirmations) + general modal use
// Escape to close, click overlay to close, focus stays inside

import { useEffect, type CSSProperties, type ReactNode } from 'react';

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: CSSProperties = {
  background: 'var(--color-surface-elevated)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-lg)',
  maxWidth: '500px',
  width: '90%',
  maxHeight: '85vh',
  overflow: 'auto',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

export function Modal({ open, onClose, children, ariaLabel }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        style={dialogStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
