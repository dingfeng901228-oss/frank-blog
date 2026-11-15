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
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Close the drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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

  // Authenticated gate — show a skeleton in the shape of the admin shell
  // while we verify, render the full layout once confirmed. Avoids the
  // brief Sidebar flash for unauthenticated users.
  //
  // Item 17 — this used to be a blank page with the text "加载中…",
  // which flashed on every route change.
  if (!authChecked) {
    return <ShellSkeleton />;
  }

  // Authenticated: Sidebar + main content flex layout.
  return (
    <div className="admin-shell">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div
        className={`admin-backdrop${menuOpen ? ' admin-backdrop-visible' : ''}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Item 17 — the hamburger that opens the sidebar on a phone. */}
        <div className="admin-mobile-bar">
          <button
            type="button"
            className="admin-hamburger"
            aria-label="打开菜单"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.1em' }}>FRANK CMS</span>
        </div>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}

/**
 * The placeholder shown while the session is verified.
 *
 * It mirrors the shape of the admin so the layout does not jump when
 * the real content arrives.
 */
function ShellSkeleton() {
  return (
    <div className="admin-shell">
      <div className="admin-sidebar" aria-hidden="true">
        <div className="skeleton" style={{ height: 18, width: 120, marginBottom: 40 }} />
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 30, marginBottom: 8, opacity: 1 - i * 0.08 }}
          />
        ))}
      </div>
      <div className="admin-main">
        <div className="skeleton" style={{ height: 34, width: '38%', marginBottom: 28 }} />
        <div className="skeleton" style={{ height: 16, width: '55%', marginBottom: 32 }} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 140, borderRadius: 'var(--radius-md)' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
