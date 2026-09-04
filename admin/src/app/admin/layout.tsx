// src/app/admin/layout.tsx
// Admin section layout — Phase 1c: added Sidebar + flex layout
// (No locale prefix, no site navbar — admin is intentionally separate)

import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import { Sidebar } from '@/components/Sidebar';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
});

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div
        className={inter.variable}
        style={{
          fontFamily: 'var(--font-inter)',
          display: 'flex',
          minHeight: '100vh',
          background: 'var(--color-bg)',
          color: 'var(--color-text-primary)',
        }}
      >
        <Sidebar />
        <main style={{ flex: 1, padding: 'var(--space-2xl) var(--space-xl)', minWidth: 0 }}>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}

export const metadata = {
  title: 'Admin — blog.frank2025.com',
  robots: 'noindex, nofollow',
};
