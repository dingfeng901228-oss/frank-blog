// src/app/admin/page.tsx
// Admin dashboard — client component
// Phase 4 placeholder: shows user info + logout + coming-soon roadmap
// Phase 5+ will add: post list, stats, recent activity

'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import type { AuthUser } from '@/lib/cms/api-client';

export default function DashboardPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/auth/me', { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          // Middleware should have caught this, but double-check
          window.location.href = '/admin/login';
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.success) {
          setUser(data.data.user);
        } else {
          setError(data.error?.message || 'Failed to load user');
        }
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await fetch('/api/admin/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = '/admin/login';
  }

  if (loading) {
    return (
      <div style={{ ...pageStyle, padding: 40 }}>
        <p style={{ color: '#707080' }}>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...pageStyle, padding: 40 }}>
        <p style={{ color: '#ef4444' }}>Error: {error}</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via the 401 handler above
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        {/* Header */}
        <div style={headerStyle}>
          <h1 style={{ fontSize: 32, fontWeight: 500, fontFamily: 'Georgia, serif' }}>
            Blog CMS
          </h1>
          <button onClick={handleLogout} style={logoutButtonStyle}>
            Logout
          </button>
        </div>

        {/* Welcome card */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Welcome</h2>
          <p style={{ fontSize: 18, marginBottom: 4 }}>
            {user.display_name || user.email}
          </p>
          <p style={{ fontSize: 13, color: '#707080' }}>
            {user.email} · {user.role}
          </p>
        </div>

        {/* Stats card (Phase 5 fills in real numbers) */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Stats</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
            <Stat label="Articles" value="—" />
            <Stat label="Published" value="—" />
            <Stat label="Drafts" value="—" />
            <Stat label="Categories" value="—" />
            <Stat label="Tags" value="—" />
          </div>
          <p style={{ fontSize: 12, color: '#707080', marginTop: 12 }}>
            Real numbers come online in Phase 5 (Posts CRUD).
          </p>
        </div>

        {/* Navigation */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Manage</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/admin/posts" style={navLinkStyle}>📝 Posts</Link>
            <Link href="/admin/posts/new" style={navLinkStyle}>+ New Post</Link>
          </div>
        </div>

        {/* Roadmap */}
        <div style={cardStyle}>
          <h2 style={cardTitleStyle}>Roadmap</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <RoadmapItem phase="Phase 1" label="D1 schema + wrangler binding + admin seed" status="done" />
            <RoadmapItem phase="Phase 2" label="Worker skeleton + 14 route modules" status="done" />
            <RoadmapItem phase="Phase 3" label="Auth (PBKDF2 + HttpOnly Session Cookie)" status="done" />
            <RoadmapItem phase="Phase 4" label="Admin Login UI + Dashboard SPA" status="active" />
            <RoadmapItem phase="Phase 5" label="Posts CRUD + MDX storage + multi-language" status="pending" />
            <RoadmapItem phase="Phase 6" label="Preview (reuse frontend MDX renderer)" status="pending" />
            <RoadmapItem phase="Phase 7" label="Publish Hook → CF Pages Build" status="pending" />
            <RoadmapItem phase="Phase 8" label="MDX → D1 migration script" status="pending" />
            <RoadmapItem phase="Phase 9" label="SSG Rebuild integration" status="pending" />
            <RoadmapItem phase="Phase 10" label="URL/SEO regression test" status="pending" />
            <RoadmapItem phase="Phase 11" label="Switch /admin to new CMS, keep /_admin 30d" status="pending" />
          </ul>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 24, fontFamily: 'Georgia, serif', fontWeight: 500 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#707080', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function RoadmapItem({
  phase,
  label,
  status,
}: {
  phase: string;
  label: string;
  status: 'done' | 'active' | 'pending';
}) {
  const color = status === 'done' ? '#10b981' : status === 'active' ? '#00D4C8' : '#707080';
  const bullet = status === 'done' ? '✓' : status === 'active' ? '◉' : '○';
  return (
    <li style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
      <span style={{ color, fontFamily: 'monospace', width: 18 }}>{bullet}</span>
      <span style={{ color: '#707080', fontFamily: 'monospace', minWidth: 70 }}>{phase}</span>
      <span style={{ color: '#E8E8EC' }}>{label}</span>
    </li>
  );
}

// ────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#0A0A0F',
  color: '#E8E8EC',
  padding: '40px 24px',
  fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
  WebkitFontSmoothing: 'antialiased',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 40,
};

const logoutButtonStyle: CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'transparent',
  color: '#E8E8EC',
  border: '1px solid #1E1E2E',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const cardStyle: CSSProperties = {
  backgroundColor: '#14141C',
  border: '1px solid #1E1E2E',
  padding: 24,
  borderRadius: 12,
  marginBottom: 16,
};

const cardTitleStyle: CSSProperties = {
  fontSize: 11,
  color: '#707080',
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  marginBottom: 16,
  fontFamily: "'SF Mono', monospace",
};

const navLinkStyle: CSSProperties = {
  padding: '10px 16px',
  backgroundColor: '#0A0A0F',
  border: '1px solid #1E1E2E',
  borderRadius: 8,
  color: '#E8E8EC',
  textDecoration: 'none',
  fontSize: 13,
};
