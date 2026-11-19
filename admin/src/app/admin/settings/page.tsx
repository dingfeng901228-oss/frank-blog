'use client';

// src/app/admin/settings/page.tsx
//
// Three sections:
//   - 站点设置 (item 16): the site title, description, default language
//     and timezone. They live in the `settings` table and are read and
//     written through GET/PUT /api/admin/settings.
//   - 导出全部数据 (item 16): downloads every article, tag and category
//     as JSON or Markdown.
//   - 账户: the account info and the password change that were already
//     here.

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost, apiPut, errorMessage } from '@/lib/cms/api-client';
import { formatDateTime } from '@/lib/cms/format';

interface Me {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
}

/**
 * The state of the published site versus the database.
 *
 * The site is a static build: every content change needs a Cloudflare
 * Pages build to reach the public pages. This panel shows whether the
 * live site is in sync, and offers a manual check.
 */
interface SiteStatus {
  in_sync: boolean;
  reason: string;
  content_synced_at: string | null;
  latest_update: string | null;
  site_urls: number;
  db_urls: number;
}

const DEFAULT_SETTINGS: Record<string, string> = {
  site_title: 'Frank Ding',
  site_description: 'IT 基础设施运维与日本 IT 职业转型记录',
  default_locale: 'ja',
  timezone: 'Asia/Tokyo',
};

const TIMEZONES = [
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Seoul',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'UTC',
];

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  // Item 16 — the site settings.
  const [settings, setSettings] = useState<Record<string, string>>(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // The published site versus the database.
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);
  const [checkingSite, setCheckingSite] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/auth/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load account info');
        const data = await res.json();
        if (!cancelled) setMe(data.data?.user ?? null);
      } catch (e: unknown) {
        if (!cancelled) toast.show(errorMessage(e, '加载账户信息失败'), 'error');
      } finally {
        if (!cancelled) setLoadingMe(false);
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  // Item 16 — load the site settings.
  useEffect(() => {
    let cancelled = false;
    apiGet<{ settings?: Record<string, string> }>('/api/admin/settings')
      .then((data) => {
        if (cancelled) return;
        setSettings({ ...DEFAULT_SETTINGS, ...(data.settings ?? {}) });
      })
      .catch(() => {
        /* the defaults stay in place */
      });
    return () => { cancelled = true; };
  }, []);

  // The published site versus the database.
  useEffect(() => {
    let cancelled = false;
    apiGet<SiteStatus>('/api/admin/site/status')
      .then((data) => {
        if (!cancelled) setSiteStatus(data);
      })
      .catch(() => {
        /* the panel simply stays empty */
      });
    return () => { cancelled = true; };
  }, []);

  /** Check the site, and rebuild it if it is behind. */
  async function handleCheckSite() {
    setCheckingSite(true);
    try {
      const result = await apiPost<{
        stale: boolean;
        reason: string;
        triggered: boolean;
      }>('/api/admin/site/reconcile', {});
      if (result.triggered) {
        toast.show('站点落后于数据库，已触发重建（约 2–3 分钟）', 'success');
      } else if (result.stale) {
        toast.show(`站点仍然落后：${result.reason}`, 'error');
      } else {
        toast.show('站点与数据库一致', 'success');
      }
      const status = await apiGet<SiteStatus>('/api/admin/site/status');
      setSiteStatus(status);
    } catch (e: unknown) {
      toast.show(errorMessage(e, '检查失败'), 'error');
    } finally {
      setCheckingSite(false);
    }
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    try {
      await apiPut('/api/admin/settings', { settings });
      toast.show('站点设置已保存', 'success');
    } catch (e: unknown) {
      toast.show(errorMessage(e, '保存失败'), 'error');
    } finally {
      setSavingSettings(false);
    }
  }

  /**
   * Item 16 — export everything the CMS owns.
   *
   * The API builds the file (articles + tags + categories), so the
   * download is a plain link to a generated file.
   */
  async function handleExport(format: 'json' | 'markdown') {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/export?format=${format}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error(`导出失败（HTTP ${res.status}）`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        format === 'json'
          ? 'frank-blog-export.json'
          : 'frank-blog-export.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.show('导出已开始', 'success');
    } catch (e: unknown) {
      toast.show(errorMessage(e, '导出失败'), 'error');
    } finally {
      setExporting(false);
    }
  }

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
    } catch (e: unknown) {
      toast.show(errorMessage(e, '修改失败'), 'error');
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

      {/* Item 16 — the site settings. */}
      <Card padding="md">
        <h2 style={sectionTitle}>站点设置</h2>
        <div style={fieldRow}>
          <label style={labelStyle}>站点标题</label>
          <input
            type="text"
            value={settings.site_title ?? ''}
            onChange={(e) => setSettings((s) => ({ ...s, site_title: e.target.value }))}
            style={inputStyle}
          />
        </div>
        <div style={fieldRow}>
          <label style={labelStyle}>站点描述</label>
          <textarea
            value={settings.site_description ?? ''}
            onChange={(e) => setSettings((s) => ({ ...s, site_description: e.target.value }))}
            style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
          />
          <div style={helpStyle}>用于 SEO 的摘要描述。</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>默认语言</label>
            <select
              value={settings.default_locale ?? 'ja'}
              onChange={(e) => setSettings((s) => ({ ...s, default_locale: e.target.value }))}
              style={inputStyle}
            >
              <option value="ja">日文</option>
              <option value="zh">中文</option>
              <option value="en">英文</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>时区</label>
            <select
              value={settings.timezone ?? 'Asia/Tokyo'}
              onChange={(e) => setSettings((s) => ({ ...s, timezone: e.target.value }))}
              style={inputStyle}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={handleSaveSettings} disabled={savingSettings} variant="primary">
            {savingSettings ? '保存中…' : '保存站点设置'}
          </Button>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      {/* Item 16 — export everything. */}
      <Card padding="md">
        <h2 style={sectionTitle}>导出全部数据</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
          导出全部文章（含各语言版本）、标签和分类。JSON 适合备份，Markdown 适合阅读和迁移。
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button onClick={() => handleExport('json')} disabled={exporting}>
            {exporting ? '导出中…' : '导出 JSON'}
          </Button>
          <Button onClick={() => handleExport('markdown')} disabled={exporting}>
            导出 Markdown
          </Button>
        </div>
      </Card>

      <div style={{ height: 16 }} />

      {/* The published site versus the database. */}
      <Card padding="md">
        <h2 style={sectionTitle}>站点同步状态</h2>
        {siteStatus ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                marginBottom: 12,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: siteStatus.in_sync ? 'var(--color-success)' : 'var(--color-warning)',
                }}
              />
              <span style={{ color: 'var(--color-text-primary)' }}>
                {siteStatus.in_sync ? '前台与数据库一致' : '前台落后于数据库'}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>{siteStatus.reason}</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 1fr',
                rowGap: 8,
                columnGap: 16,
                fontSize: 12,
                color: 'var(--color-text-secondary)',
              }}
            >
              <span style={{ color: 'var(--color-text-muted)' }}>站点内容时间</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {siteStatus.content_synced_at ? formatDateTime(siteStatus.content_synced_at) : '—'}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>数据库最新更新</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {siteStatus.latest_update ? formatDateTime(siteStatus.latest_update) : '—'}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>文章数量</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                站点 {siteStatus.site_urls} 篇 / 数据库 {siteStatus.db_urls} 篇
              </span>
            </div>
            <div style={{ marginTop: 14 }}>
              <Button onClick={handleCheckSite} disabled={checkingSite}>
                {checkingSite ? '检查中…' : '立即检查并在需要时重建'}
              </Button>
            </div>
            <div style={helpStyle}>
              前台是静态构建，内容改动需要一次构建才会生效。后台每 5 分钟自动核对一次，
              发现前台落后就会自动重建。
            </div>
          </>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>正在检查…</p>
        )}
      </Card>

      <div style={{ height: 16 }} />

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
