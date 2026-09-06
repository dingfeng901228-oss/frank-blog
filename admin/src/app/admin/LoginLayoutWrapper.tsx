'use client';

// src/app/admin/LoginLayoutWrapper.tsx
// Client wrapper that conditionally renders the Sidebar layout for
// authenticated routes, or a centered card layout for /admin/login.
// Lives in admin/layout.tsx as a sibling because App Router layouts
// can't be conditionally rendered from a server component.

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';

export function LoginLayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const isLogin = pathname === '/admin/login' || pathname === '/admin/login/';

  if (isLogin) {
    // Unauthenticated: center the login card, no nav chrome at all.
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-2xl) var(--space-xl)',
        }}
      >
        {children}
      </main>
    );
  }

  // Authenticated: Sidebar + main content flex layout.
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: 'var(--space-2xl) var(--space-xl)', minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
