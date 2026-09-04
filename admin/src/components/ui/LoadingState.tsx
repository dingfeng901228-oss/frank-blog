'use client';

// src/components/ui/LoadingState.tsx — Phase 1b
// Per docs/CMS V2.md §三十三

import type { CSSProperties } from 'react';

const containerStyle: CSSProperties = {
  padding: 'var(--space-2xl) var(--space-lg)',
  textAlign: 'center',
  color: 'var(--color-text-muted)',
  fontSize: 'var(--font-size-sm)',
};

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
  return <div style={containerStyle}>{message}</div>;
}
