// src/app/admin/layout.tsx
// Admin section layout — Sidebar only renders for authenticated routes
// (anything except /admin/login). /admin/login uses a centered card layout
// instead of the Sidebar + main flexbox so the navigation chrome doesn't
// leak into the unauthenticated state.
// Per SOUL: the login page must look obviously "unauthorized" — no nav, no
// dashboard peek, just the login form centered on the screen.

import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui/Toast';
import { LoginLayoutWrapper } from './LoginLayoutWrapper';
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
          minHeight: '100vh',
          background: 'var(--color-bg)',
          color: 'var(--color-text-primary)',
        }}
      >
        <LoginLayoutWrapper>{children}</LoginLayoutWrapper>
      </div>
    </ToastProvider>
  );
}

export const metadata = {
  title: 'Admin — blog.frank2025.com',
  robots: 'noindex, nofollow',
};
