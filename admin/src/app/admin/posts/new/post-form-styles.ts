// src/app/admin/posts/[new|edit]/post-form-styles.ts
// Shared styles for new + edit post forms

import type { CSSProperties } from 'react';

export const postFormStyles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#0A0A0F',
    color: '#E8E8EC',
    padding: '40px 24px',
    fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
    WebkitFontSmoothing: 'antialiased',
  } as CSSProperties,

  backLink: {
    fontSize: 12,
    color: '#707080',
    textDecoration: 'none',
  } as CSSProperties,

  h1: {
    fontSize: 28,
    fontWeight: 500,
    fontFamily: 'Georgia, serif',
    marginTop: 8,
    marginBottom: 24,
  } as CSSProperties,

  error: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 16,
    padding: '8px 12px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
  } as CSSProperties,

  form: {
    backgroundColor: '#14141C',
    border: '1px solid #1E1E2E',
    padding: 24,
    borderRadius: 12,
  } as CSSProperties,

  label: {
    display: 'block',
    fontSize: 11,
    color: '#707080',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginBottom: 6,
  } as CSSProperties,

  labelHint: {
    fontSize: 11,
    color: '#707080',
    textTransform: 'none' as const,
    letterSpacing: 'normal',
  } as CSSProperties,

  input: {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: '#0A0A0F',
    border: '1px solid #1E1E2E',
    borderRadius: 8,
    color: '#E8E8EC',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  } as CSSProperties,

  primaryButton: {
    padding: '10px 24px',
    backgroundColor: '#00D4C8',
    color: '#0A0A0F',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
    display: 'inline-block',
  } as CSSProperties,

  secondaryButton: {
    padding: '10px 24px',
    backgroundColor: 'transparent',
    color: '#E8E8EC',
    border: '1px solid #1E1E2E',
    borderRadius: 8,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
    display: 'inline-block',
  } as CSSProperties,
};
