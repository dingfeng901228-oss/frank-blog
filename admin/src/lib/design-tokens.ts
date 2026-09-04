// src/lib/design-tokens.ts
// Phase 1a — design tokens per docs/CMS V2.md §七-八
// Reuse in components via CSS variables (var(--color-bg)) or this TS object

export const colors = {
  // Background levels (§八 颜色系统)
  bg: '#0B0C10',
  surface: '#111318',
  surfaceElevated: '#171922',
  border: '#272B36',

  // Text
  textPrimary: '#F5F7FA',
  textSecondary: '#A6ADBB',
  textMuted: '#707887',

  // Semantic (carried over from existing admin inline styles)
  primary: '#00D4C8',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
} as const;

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
} as const;

export const radius = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  full: '9999px',
} as const;

export const fontSize = {
  xs: '11px',
  sm: '12px',
  base: '14px',
  md: '16px',
  lg: '20px',
  xl: '28px',
  '2xl': '36px',
} as const;

// §七 字体系统 — UI/Heading 用 Inter，monospace 只给 slug/URL/code/markdown
export const fontFamily = {
  sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  mono: '"SF Mono", "Fira Code", Consolas, monospace',
} as const;

export type Color = keyof typeof colors;
export type Spacing = keyof typeof spacing;
export type Radius = keyof typeof radius;
