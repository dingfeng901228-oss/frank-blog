'use client';

// src/app/admin/LoginLayoutWrapper.tsx
// Client wrapper that:
//   1. Verifies the user is authenticated (via GET /api/admin/auth/me).
//      Unauthenticated users hitting any /admin/* route are redirected to
//      /admin/login. /admin/login itself skips the check (it would be a
//      redirect loop).
//   2. Conditionally renders the centered login card (for /admin/login) or
//      the Sidebar + main flexbox layout (for everything else).
//
// Phase 11: the auth gate was added because the previous build relied on
// each page making its own API call to discover unauthenticated state. That
// meant an unauthenticated user could navigate directly to /admin/posts and
// briefly see the Sidebar + empty table shell before the first API call
// returned 401. Worse, pages that don't load data (e.g. direct URL paste to
// /admin/posts/edit?id=X) would render the chrome indefinitely. With this
// gate, auth status is established once at the layout level and the entire
// /admin/* tree is unreachable without a valid session.

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';

export function LoginLayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const isLogin = pathname === '/admin/login' || pathname === '/admin/login/';

  const [authChecked, setAuthChecked] = useState(isLogin);

  useEffect(() => {
    if (isLogin) {
      // Login page: nothing to check. Anyone landing here is, by definition,
      // not yet authenticated (or is mid-logout).
      return;
    }

    let cancelled = false;

    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/auth/me', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (cancelled) return;
        if (!res.ok) {
          // 401 = no session, 403 = CSRF_INVALID (rare without a session,
          // but treat both as "go log in"). api-client auto-redirects on 401,
          // but here we control the layout directly.
          router.replace('/admin/login');
          return;
        }
        const data = await res.json();
        if (!cancelled && data?.success === false) {
          router.replace('/admin/login');
          return;
        }
        setAuthChecked(true);
      } catch {
        if (!cancelled) router.replace('/admin/login');
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [isLogin, router]);

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

  // Authenticated gate — show a thin loading state while we verify, render
  // the full layout once confirmed. Avoids the brief Sidebar flash for
  // unauthenticated users.
  if (!authChecked) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
          fontSize: 14,
        }}
      >
        加载中…
      </div>
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
