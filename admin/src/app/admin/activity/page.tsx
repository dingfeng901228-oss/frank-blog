'use client';

// src/app/admin/activity/page.tsx — Phase 6 (Activity log UI)
// Per docs/CMS V2.md §二十五 (Activity log — user / Published / Updated / Uploaded / Logged in)
//
// Item 15 — the log can be filtered and searched, a failed deploy can
// be inspected (when it failed, on which article, and with which
// error) and retried.
//
// Item 11 — the event names are the shared Chinese labels, and the
// dates use the admin's one format (YYYY-MM-DD HH:mm) instead of the
// mixed "3 分钟前" / ISO forms.

import { useEffect, useState, type CSSProperties } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost, errorMessage } from '@/lib/cms/api-client';
import { formatAction, formatDateTime } from '@/lib/cms/format';

interface ActivityEntry {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  message?: string | null;
  created_at: string;
}

interface ActivityDetail {
  entry: ActivityEntry;
  post: {
    id: number;
    collection: string;
    locale: string;
    slug: string;
    title: string;
    status: string;
  } | null;
}

const ACTION_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部事件' },
  { value: 'deploy', label: '部署相关' },
  { value: 'failed', label: '失败事件' },
  { value: 'login', label: '登录' },
  { value: 'publish_post', label: '发布文章' },
  { value: 'update_post', label: '更新文章' },
  { value: 'scheduled_publish', label: '定时发布' },
];

function actionIcon(entry: ActivityEntry): string {
  if (entry.action.includes('failed')) return '!';
  if (entry.action.includes('publish')) return '✓';
  if (entry.action === 'login' || entry.action === 'logout') return '•';
  return '·';
}

function actionColor(entry: ActivityEntry): string {
  if (entry.action.includes('failed')) return 'var(--color-danger)';
  if (entry.action.includes('publish')) return 'var(--color-success)';
  return 'var(--color-text-muted)';
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Item 15 — filters.
  const [action, setAction] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // The detail of the selected entry (the "查看详情" panel).
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const toast = useToast();

  async function fetchActivity() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (action) params.set('action', action);
      if (query.trim()) params.set('q', query.trim());
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const data = await apiGet<{ items: ActivityEntry[] }>(`/api/admin/activity?${params}`);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: unknown) {
      setError(errorMessage(e, '活动日志加载失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, from, to]);

  async function openDetail(entry: ActivityEntry) {
    setDetailLoading(true);
    try {
      const data = await apiGet<ActivityDetail>(`/api/admin/activity/${entry.id}`);
      setDetail(data);
    } catch (e: unknown) {
      toast.show(errorMessage(e, '详情加载失败'), 'error');
    } finally {
      setDetailLoading(false);
    }
  }

  async function retryDeploy(entry: ActivityEntry) {
    if (!entry.resource_id) {
      toast.show('这条记录没有关联文章，无法重试', 'error');
      return;
    }
    setRetrying(true);
    try {
      const data = await apiPost<{ deploy_triggered: boolean; deploy_error: string | null }>(
        `/api/admin/posts/${entry.resource_id}/redeploy`,
        {}
      );
      if (data.deploy_triggered) {
        toast.show('已重新触发部署', 'success');
      } else {
        toast.show('重试失败，请稍后再试', 'error');
      }
      fetchActivity();
    } catch (e: unknown) {
      toast.show(errorMessage(e, '重试失败'), 'error');
    } finally {
      setRetrying(false);
    }
  }

  const titleStyle: CSSProperties = {
    fontSize: 28,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    marginBottom: 4,
  };

  const subStyle: CSSProperties = {
    fontSize: 12,
    color: 'var(--color-text-muted)',
    fontFamily: 'var(--font-mono)',
  };

  const itemStyle: CSSProperties = {
    padding: 'var(--space-sm) 0',
    borderBottom: '1px solid var(--color-border)',
    fontSize: 13,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={titleStyle}>活动日志</h1>
        <p style={subStyle}>共 {items.length} 条记录</p>
      </div>

      {/* Item 15 — filter + search. */}
      <Card padding="md" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={labelStyle}>事件类型</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              style={{ ...inputStyle, minWidth: 150 }}
              aria-label="事件类型"
            >
              {ACTION_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>搜索</label>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchActivity();
              }}
              placeholder="事件名、错误信息或用户名"
              style={{ ...inputStyle, width: 240 }}
              aria-label="搜索活动日志"
            />
          </div>
          <div>
            <label style={labelStyle}>开始日期</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={inputStyle}
              aria-label="开始日期"
            />
          </div>
          <div>
            <label style={labelStyle}>结束日期</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={inputStyle}
              aria-label="结束日期"
            />
          </div>
          <Button variant="primary" onClick={fetchActivity}>
            查询
          </Button>
          {(action || query || from || to) && (
            <Button
              variant="ghost"
              onClick={() => {
                setAction('');
                setQuery('');
                setFrom('');
                setTo('');
              }}
            >
              清除筛选
            </Button>
          )}
        </div>
      </Card>

      {error ? (
        <ErrorState
          title="加载活动日志失败"
          description={error}
          action={
            <Button variant="primary" onClick={fetchActivity}>
              重试
            </Button>
          }
        />
      ) : loading ? (
        <ActivitySkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title="没有符合条件的记录"
          description="换个筛选条件或时间范围试试。"
        />
      ) : (
        <Card padding="md">
          {items.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                ...itemStyle,
                borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-secondary)', flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    fontSize: 11,
                    color: actionColor(entry),
                    background: 'var(--color-surface-elevated)',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0,
                  }}
                >
                  {actionIcon(entry)}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {formatAction(entry.action)}
                  {entry.resource_id ? ` #${entry.resource_id}` : ''}
                </span>
                {entry.username && (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                    @{entry.username}
                  </span>
                )}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  {formatDateTime(entry.created_at)}
                </span>
                <button style={linkButtonStyle} onClick={() => openDetail(entry)}>
                  详情
                </button>
              </span>
            </div>
          ))}
        </Card>
      )}

      {/* Item 15 — the detail panel. */}
      {detail && (
        <Card padding="md" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text-primary)' }}>
              记录 #{detail.entry.id}
            </h2>
            <button style={linkButtonStyle} onClick={() => setDetail(null)}>
              关闭
            </button>
          </div>
          <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px 16px', margin: 0, fontSize: 13 }}>
            <dt style={{ color: 'var(--color-text-muted)' }}>事件</dt>
            <dd style={{ margin: 0 }}>{formatAction(detail.entry.action)}</dd>
            <dt style={{ color: 'var(--color-text-muted)' }}>时间</dt>
            <dd style={{ margin: 0, fontFamily: 'var(--font-mono)' }}>
              {formatDateTime(detail.entry.created_at)}
            </dd>
            <dt style={{ color: 'var(--color-text-muted)' }}>操作人</dt>
            <dd style={{ margin: 0 }}>{detail.entry.username ? `@${detail.entry.username}` : '—'}</dd>
            {detail.post && (
              <>
                <dt style={{ color: 'var(--color-text-muted)' }}>相关文章</dt>
                <dd style={{ margin: 0 }}>
                  {detail.post.title}
                  <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11, marginLeft: 8 }}>
                    /{detail.post.collection}/{detail.post.locale}/{detail.post.slug}
                  </span>
                </dd>
              </>
            )}
            {detail.entry.message && (
              <>
                <dt style={{ color: 'var(--color-text-muted)' }}>错误信息</dt>
                <dd style={{ margin: 0, color: 'var(--color-danger)', wordBreak: 'break-word' }}>
                  {detail.entry.message}
                </dd>
              </>
            )}
          </dl>
          {detail.entry.action.includes('failed') && detail.post && (
            <div style={{ marginTop: 16 }}>
              <Button variant="primary" onClick={() => retryDeploy(detail.entry)} disabled={retrying}>
                {retrying ? '重试中…' : '重试部署'}
              </Button>
            </div>
          )}
        </Card>
      )}
      {detailLoading && <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>正在加载详情…</p>}
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <Card padding="md">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 16, width: `${50 + (i % 4) * 14}%`, marginBottom: 14 }}
        />
      ))}
    </Card>
  );
}

const inputStyle: CSSProperties = {
  padding: '6px 10px',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'inherit',
  fontSize: 13,
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 4,
  display: 'block',
};

const linkButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-primary)',
  fontSize: 12,
  fontFamily: 'inherit',
  padding: 0,
};
