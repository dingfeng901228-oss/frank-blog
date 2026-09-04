'use client';

// src/components/PlaceholderPage.tsx — Phase 1c
// Shared placeholder for routes that will be filled in by later phases
// (Blog/Notes/Drafts/Categories/Tags/Media/Activity/Settings)

import type { ReactNode } from 'react';

interface PlaceholderPageProps {
  title: string;
  phase: string;
  description: string;
  action?: ReactNode;
}

export function PlaceholderPage({ title, phase, description, action }: PlaceholderPageProps) {
  const containerStyle = {
    maxWidth: 720,
  };

  const titleStyle = {
    fontSize: 'var(--font-size-2xl)',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: 'var(--space-md)',
  };

  const phaseStyle = {
    display: 'inline-block',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--color-primary)',
    background: 'var(--color-surface-elevated)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    marginBottom: 'var(--space-md)',
    fontFamily: 'var(--font-mono)',
  };

  const cardStyle = {
    padding: 'var(--space-lg)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
  };

  const descStyle = {
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.6,
  };

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>{title}</h1>
      <div style={phaseStyle}>{phase}</div>
      <div style={cardStyle}>
        <div style={descStyle}>{description}</div>
        {action && <div style={{ marginTop: 'var(--space-lg)' }}>{action}</div>}
      </div>
    </div>
  );
}
