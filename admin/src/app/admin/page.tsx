'use client';

// src/app/admin/page.tsx — Phase 1d
// New Dashboard per docs/CMS V2.md §五 (Blog/Notes stats) + §九 (no big Welcome card) + §三十四 (final structure)
// Real D1 counts via existing /api/admin/posts endpoint (collection + status filters)
//
// Item 2 — the "最近活动" panel read `data.data.activities` while the
// API returns `data.data.items`, so the panel always fell through to
// the empty state even though the activity log had 30 records. It now
// reads the same field the activity page reads.
//
// Item 11 — dates use the admin's one format (YYYY-MM-DD HH:mm) and the
// event names come from the shared Chinese label map, so the dashboard
// and the activity log say the same thing.

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiGet, errorMessage } from '@/lib/cms/api-client';
import { formatAction, formatDateTime } from '@/lib/cms/format';

interface Count {
  total: number;
  published: number;
  drafts: number;
}

interface ActivityItem {
  id: number;
  user_id: number | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  message?: string | null;
  created_at: string;
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
};

export default function DashboardPage() {
  const [blog, setBlog] = useState<Count | null>(null);
  const [notes, setNotes] = useState<Count | null>(null);
  const [drafts, setDrafts] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const fetchCount = async (params: string): Promise<number> => {
          const data = await apiGet<{ total: number }>(`/api/admin/posts?${params}`);
          return data.total;
        };

        // Item 2 — the same endpoint and the same field the activity
        // page uses: { items: [...] }.
        const fetchActivity = async (): Promise<ActivityItem[]> => {
          const data = await apiGet<{ items: ActivityItem[] }>(
            '/api/admin/activity/recent?limit=5'
          );
          return Array.isArray(data.items) ? data.items : [];
        };

        const [
          blogTotal,
          blogPub,
          blogDraft,
          notesTotal,
          notesPub,
          notesDraft,
          recentActs,
        ] = await Promise.all([
          // Per §0001_initial.sql: collection ∈ ('posts', 'notes') — 'blog' is a UI label, not a DB value
          fetchCount('collection=posts'),
          fetchCount('collection=posts&status=published'),
          fetchCount('collection=posts&status=draft'),
          fetchCount('collection=notes'),
          fetchCount('collection=notes&status=published'),
          fetchCount('collection=notes&status=draft'),
          fetchActivity(),
        ]);

        setBlog({ total: blogTotal, published: blogPub, drafts: blogDraft });
        setNotes({ total: notesTotal, published: notesPub, drafts: notesDraft });
        setDrafts(blogDraft + notesDraft);
        setActivity(recentActs);
      } catch (e: unknown) {
        setError(errorMessage(e, '仪表盘数据加载失败，请稍后重试。'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState title="加载仪表盘失败" description={error} />;

  const sectionTitle: CSSProperties = {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    marginBottom: 16,
    fontFamily: 'var(--font-mono)',
  };

  const cardLabel: CSSProperties = {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    marginBottom: 12,
    fontFamily: 'var(--font-mono)',
  };

  const cardNumber: CSSProperties = {
    fontSize: 36,
    fontWeight: 500,
    color: 'var(--color-text-primary)',
    lineHeight: 1,
    marginBottom: 6,
  };

  const cardSublabel: CSSProperties = {
    fontSize: 12,
    color: 'var(--color-text-muted)',
    marginBottom: 16,
  };

  const statRow: CSSProperties = {
    display: 'flex',
    gap: 16,
    fontSize: 13,
    paddingTop: 12,
    borderTop: '1px solid var(--color-border)',
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: 32, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 8 }}>
        {greeting()}，Frank
      </h1>
      <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        这是你的内容近况。
      </p>

      <div style={sectionTitle}>内容</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {blog && (
          <Card padding="lg">
            <div style={cardLabel}>博客</div>
            <div style={cardNumber}>{blog.total}</div>
            <div style={cardSublabel}>篇文章</div>
            <div style={statRow}>
              <span style={{ color: 'var(--color-success)' }}>{blog.published} 已发布</span>
              <span style={{ color: 'var(--color-warning)' }}>{blog.drafts} 草稿</span>
            </div>
          </Card>
        )}
        {notes && (
          <Card padding="lg">
            <div style={cardLabel}>随笔</div>
            <div style={cardNumber}>{notes.total}</div>
            <div style={cardSublabel}>篇</div>
            <div style={statRow}>
              <span style={{ color: 'var(--color-success)' }}>{notes.published} 已发布</span>
              <span style={{ color: 'var(--color-warning)' }}>{notes.drafts} 草稿</span>
            </div>
          </Card>
        )}
        {drafts !== null && (
          <Card padding="lg">
            <div style={cardLabel}>待发布</div>
            <div style={cardNumber}>{drafts}</div>
            <div style={cardSublabel}>篇草稿</div>
          </Card>
        )}
      </div>

      <div style={sectionTitle}>快捷操作</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
        <Link href="/admin/blog/new" style={{ textDecoration: 'none' }}>
          <button style={primaryButtonStyle}>+ 新建文章</button>
        </Link>
        <Link href="/admin/notes/new" style={{ textDecoration: 'none' }}>
          <button style={primaryButtonStyle}>+ 新建随笔</button>
        </Link>
        <Link href="/admin/media" style={{ textDecoration: 'none' }}>
          <button style={primaryButtonStyle}>媒体库</button>
        </Link>
      </div>

      <div style={sectionTitle}>最近活动</div>
      {activity && activity.length > 0 ? (
        <Card padding="md">
          {activity.map((item, i) => (
            <div
              key={item.id}
              style={{
                padding: 'var(--space-sm) 0',
                borderBottom: i < activity.length - 1 ? '1px solid var(--color-border)' : 'none',
                fontSize: 13,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {formatAction(item.action)}
                {item.message ? (
                  <span style={{ color: 'var(--color-danger)', marginLeft: 8 }}>{item.message}</span>
                ) : null}
              </span>
              <span
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatDateTime(item.created_at)}
              </span>
            </div>
          ))}
          <div style={{ paddingTop: 'var(--space-sm)' }}>
            <Link href="/admin/activity" style={{ fontSize: 12 }}>
              查看全部活动 →
            </Link>
          </div>
        </Card>
      ) : (
        <EmptyState
          title="暂无活动"
          description="一旦你开始发布文章，活动日志会显示在这里。"
        />
      )}
    </div>
  );
}

/**
 * Item 17 — the dashboard used to show a blank "加载中…" page while the
 * counts loaded. This keeps the layout stable.
 */
function DashboardSkeleton() {
  return (
    <div style={{ maxWidth: 960 }}>
      <div className="skeleton" style={{ height: 34, width: 240, marginBottom: 12 }} />
      <div className="skeleton" style={{ height: 16, width: 320, marginBottom: 32 }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 150, borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
      <div className="skeleton" style={{ height: 180, borderRadius: 'var(--radius-md)' }} />
    </div>
  );
}

const primaryButtonStyle: CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
  background: 'var(--color-primary)',
  color: 'var(--color-bg)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-base)',
  fontWeight: 500,
};
