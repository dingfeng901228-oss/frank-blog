'use client';

// src/components/ui/Card.tsx — Phase 1b
// Surface / Surface Elevated (§八 颜色系统)

import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  elevated?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const baseStyle: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
};

const paddingStyles = {
  none: { padding: 0 },
  sm: { padding: 'var(--space-sm)' },
  md: { padding: 'var(--space-md)' },
  lg: { padding: 'var(--space-lg)' },
} as const;

export function Card({ children, style, elevated = false, padding = 'md' }: CardProps) {
  return (
    <div
      style={{
        ...baseStyle,
        background: elevated ? 'var(--color-surface-elevated)' : baseStyle.background,
        ...paddingStyles[padding],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
