// src/app/admin/layout.tsx
// Admin section layout — Phase 1a: added Inter font + globals.css
// (No locale prefix, no site navbar — admin is intentionally separate)

import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
});

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={inter.variable} style={{ fontFamily: 'var(--font-inter)' }}>
      {children}
    </div>
  );
}

export const metadata = {
  title: 'Admin — blog.frank2025.com',
  robots: 'noindex, nofollow',
};
