'use client';

// src/components/ui/EmptyState.tsx — Phase 1b
// Per docs/CMS V2.md §三十三 (Loading / Empty / Error states)

import type { CSSProperties, ReactNode } from 'react';

const containerStyle: CSSProperties = {
  padding: 'var(--space-2xl) var(--space-lg)',
  textAlign: 'center',
};

const titleStyle: CSSProperties = {
  fontSize: 'var(--font-size-lg)',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  marginBottom: 'var(--space-sm)',
};

const descStyle: CSSProperties = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-muted)',
  marginBottom: 'var(--space-lg)',
};

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div style={containerStyle}>
      <div style={titleStyle}>{title}</div>
      {description && <div style={descStyle}>{description}</div>}
      {action}
    </div>
  );
}
