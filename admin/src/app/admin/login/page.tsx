// src/app/admin/login/page.tsx
// Admin login form — client component
// Per D-4: admin@frank2025.com + HttpOnly Cookie session

'use client';

import { useState, type FormEvent } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@frank2025.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        // Hard navigation so middleware on next request sees the cookie
        window.location.href = '/admin';
      } else {
        setError(data.error?.message || 'Login failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A0A0F',
        color: '#E8E8EC',
        fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <div style={{ width: '100%', maxWidth: 320, padding: 24 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 500,
            textAlign: 'center',
            marginBottom: 8,
            fontFamily: 'Georgia, serif',
          }}
        >
          Admin
        </h1>
        <p style={{ textAlign: 'center', marginBottom: 40, fontSize: 13, color: '#707080' }}>
          blog.frank2025.com
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            autoFocus
            autoComplete="email"
            style={inputStyle}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            autoComplete="current-password"
            style={inputStyle}
          />

          {error && (
            <p style={{ color: '#ef4444', fontSize: 12, marginTop: -8 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...buttonStyle,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#707080' }}>
          Sessions expire after 7 days. HttpOnly + Secure cookies.
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  backgroundColor: '#1E1E2E',
  border: '1px solid #1E1E2E',
  borderRadius: 8,
  fontSize: 13,
  color: '#E8E8EC',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  backgroundColor: '#00D4C8',
  color: '#0A0A0F',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
  transition: 'opacity 0.15s',
};
