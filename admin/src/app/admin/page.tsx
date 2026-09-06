'use client';

// src/app/admin/page.tsx — Phase 1d
// New Dashboard per docs/CMS V2.md §五 (Blog/Notes stats) + §九 (no big Welcome card) + §三十四 (final structure)
// Real D1 counts via existing /api/admin/posts endpoint (collection + status filters)

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';

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
  created_at: string;
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return '早上好';
  if (h < 18) return '下午好';
  return '晚上好';
};

const formatRelativeTime = (createdAt: string): string => {
  // admin_logs uses SQLite datetime('now') format: "YYYY-MM-DD HH:MM:SS" (UTC)
  const iso = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T') + 'Z';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return new Date(iso).toLocaleDateString();
};

const formatAction = (item: ActivityItem): string => {
  switch (item.action) {
    case 'login': return '登录';
    case 'logout': return '退出登录';
    case 'login_failed': return '登录失败';
    case 'publish_post': return '发布了文章';
    case 'unpublish_post': return '取消发布文章';
    case 'publish_post_failed': return '发布文章失败';
    case 'unpublish_post_failed': return '取消发布失败';
    default: return item.action;
  }
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
          const res = await fetch(`/api/admin/posts?${params}`, { credentials: 'include' });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error?.message || 'Failed to fetch');
          }
          return data.data.total as number;
        };

        const fetchActivity = async (): Promise<ActivityItem[]> => {
          // /api/admin/activity/recent will be added in Phase 6; return [] for now
          const res = await fetch('/api/admin/activity/recent?limit=5', { credentials: 'include' });
          if (res.status === 404) return [];
          const data = await res.json();
          if (!res.ok || !data.success) return [];
          return data.data.activities;
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
      } catch (e: any) {
        setError(e.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingState message="加载中…" />;
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
              }}
            >
              <span style={{ color: 'var(--color-text-secondary)' }}>{formatAction(item)}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                {formatRelativeTime(item.created_at)}
              </span>
            </div>
          ))}
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

const disabledButtonStyle: CSSProperties = {
  padding: 'var(--space-md) var(--space-lg)',
  background: 'var(--color-surface)',
  color: 'var(--color-text-muted)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  cursor: 'not-allowed',
  opacity: 0.5,
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-base)',
};

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
