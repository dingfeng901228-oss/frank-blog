'use client';

// src/app/admin/settings/page.tsx
// Real Settings page — replaces the PlaceholderPage stub. Two actions:
//   - Change password (calls POST /api/admin/auth/change-password)
//   - Show current account info (read-only)
//
// We deliberately don't try to be a full preferences UI yet. Adding the
// password change is the only piece Frank actually needs today; everything
// else can grow from here.

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface Me {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
}

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load account info');
        const data = await res.json();
        if (!cancelled) setMe(data.data?.user ?? null);
      } catch (e: any) {
        if (!cancelled) toast.show(e.message || '加载账户信息失败', 'error');
      } finally {
        if (!cancelled) setLoadingMe(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPw) {
      toast.show('请输入当前密码', 'error');
      return;
    }
    if (newPw.length < 8) {
      toast.show('新密码至少 8 位', 'error');
      return;
    }
    if (newPw !== newPw2) {
      toast.show('两次输入的新密码不一致', 'error');
      return;
    }
    if (newPw === currentPw) {
      toast.show('新密码不能与当前密码相同', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const csrf = (() => {
        const m = document.cookie.match(/(?:^|;\s*)cms_csrf=([^;]+)/);
        return m ? decodeURIComponent(m[1]) : '';
      })();
      const res = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({
          current_password: currentPw,
          new_password: newPw,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }
      toast.show('密码已更新', 'success');
      setCurrentPw('');
      setNewPw('');
      setNewPw2('');
    } catch (e: any) {
      toast.show(e.message || '修改失败', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const pageStyle: CSSProperties = { maxWidth: 720 };
  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 12,
    color: 'var(--color-text-muted)',
    marginBottom: 6,
    fontWeight: 500,
  };
  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };
  const fieldRow: CSSProperties = { marginBottom: 16 };
  const sectionTitle: CSSProperties = {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: 16,
  };
  const helpStyle: CSSProperties = {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    marginTop: 4,
  };

  return (
    <div style={pageStyle}>
      <h1 style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 24 }}>
        设置
      </h1>

      <Card padding="md">
        <h2 style={sectionTitle}>账户信息</h2>
        {loadingMe ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>加载中…</p>
        ) : me ? (
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 10, columnGap: 16, fontSize: 13 }}>
            <div style={{ color: 'var(--color-text-muted)' }}>邮箱</div>
            <div style={{ fontFamily: 'var(--font-mono)' }}>{me.email}</div>
            <div style={{ color: 'var(--color-text-muted)' }}>显示名</div>
            <div>{me.display_name || '—'}</div>
            <div style={{ color: 'var(--color-text-muted)' }}>角色</div>
            <div>
              <span style={{
                display: 'inline-block', padding: '2px 8px', fontSize: 11,
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
              }}>
                {me.role}
              </span>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>未能加载账户信息。</p>
        )}
      </Card>

      <div style={{ height: 16 }} />

      <Card padding="md">
        <h2 style={sectionTitle}>修改密码</h2>
        <form onSubmit={handleChangePassword}>
          <div style={fieldRow}>
            <label style={labelStyle}>当前密码</label>
            <input
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
              required
            />
          </div>
          <div style={fieldRow}>
            <label style={labelStyle}>新密码</label>
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
              required
            />
            <div style={helpStyle}>至少 8 位</div>
          </div>
          <div style={fieldRow}>
            <label style={labelStyle}>确认新密码</label>
            <input
              type="password"
              value={newPw2}
              onChange={(e) => setNewPw2(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? '提交中…' : '修改密码'}
            </Button>
          </div>
        </form>
      </Card>

      <div style={{ height: 16 }} />

      <Card padding="md">
        <h2 style={sectionTitle}>会话</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginBottom: 12 }}>
          退出当前会话请使用侧边栏底部的 “退出登录” 按钮。
        </p>
        <Link href="/admin/login" style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
          去登录页 →
        </Link>
      </Card>
    </div>
  );
}