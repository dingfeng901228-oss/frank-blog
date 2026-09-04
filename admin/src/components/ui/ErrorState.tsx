'use client';

// src/components/ui/ErrorState.tsx — Phase 1b
// Per docs/CMS V2.md §三十三

import type { CSSProperties, ReactNode } from 'react';

const containerStyle: CSSProperties = {
  padding: 'var(--space-2xl) var(--space-lg)',
  textAlign: 'center',
};

const titleStyle: CSSProperties = {
  fontSize: 'var(--font-size-lg)',
  fontWeight: 500,
  color: 'var(--color-danger)',
  marginBottom: 'var(--space-sm)',
};

const descStyle: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-muted)',
  marginBottom: 'var(--space-lg)',
};

interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again.',
  action,
}: ErrorStateProps) {
  return (
    <div style={containerStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={descStyle}>{description}</div>
      {action}
    </div>
  );
}
