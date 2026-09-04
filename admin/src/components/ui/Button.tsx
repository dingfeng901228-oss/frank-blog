'use client';

// src/components/ui/Button.tsx — Phase 1b
// Per docs/CMS V2.md §三十二 (unified toast + actions)
// Variants: primary / secondary / ghost / danger
// Sizes: sm / md / lg

import type { CSSProperties, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-sm)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'background 0.15s, border-color 0.15s',
};

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 'var(--font-size-sm)' },
  md: { padding: 'var(--space-sm) var(--space-md)', fontSize: 'var(--font-size-base)' },
  lg: { padding: 'var(--space-md) var(--space-lg)', fontSize: 'var(--font-size-md)' },
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: 'var(--color-primary)',
    color: 'var(--color-bg)',
  },
  secondary: {
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-secondary)',
  },
  danger: {
    background: 'var(--color-danger)',
    color: '#fff',
  },
};

interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  style?: CSSProperties;
  title?: string;
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  onClick,
  disabled,
  type = 'button',
  style,
  title,
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        ...baseStyle,
        ...sizeStyles[size],
        ...variantStyles[variant],
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
