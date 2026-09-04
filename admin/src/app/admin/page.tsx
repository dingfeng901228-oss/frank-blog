'use client';

// src/app/admin/page.tsx — Phase 1d
// New Dashboard per docs/CMS V2.md §五 (Blog/Notes stats) + §九 (no big Welcome card) + §三十四 (final structure)
// Real D1 counts via existing /api/admin/posts endpoint (collection + status filters)

import { useEffect, useState, type CSSProperties } from 'react';
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
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const formatRelativeTime = (createdAt: string): string => {
  // admin_logs uses SQLite datetime('now') format: "YYYY-MM-DD HH:MM:SS" (UTC)
  const iso = createdAt.includes('T') ? createdAt : createdAt.replace(' ', 'T') + 'Z';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
};

const formatAction = (item: ActivityItem): string => {
  switch (item.action) {
    case 'login':
      return 'Logged in';
    case 'logout':
      return 'Logged out';
    case 'login_failed':
      return 'Failed login attempt';
    case 'publish_post':
      return 'Published a post';
    case 'unpublish_post':
      return 'Unpublished a post';
    case 'publish_post_failed':
      return 'Failed to publish a post';
    case 'unpublish_post_failed':
      return 'Failed to unpublish a post';
    default:
      return item.action;
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
          fetchCount('collection=blog'),
          fetchCount('collection=blog&status=published'),
          fetchCount('collection=blog&status=draft'),
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

  if (loading) return <LoadingState message="Loading dashboard..." />;
  if (error) return <ErrorState title="Failed to load dashboard" description={error} />;

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
        {greeting()}, Frank.
      </h1>
      <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Here's what's happening with your content.
      </p>

      <div style={sectionTitle}>Content</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        {blog && (
          <Card padding="lg">
            <div style={cardLabel}>Blog</div>
            <div style={cardNumber}>{blog.total}</div>
            <div style={cardSublabel}>Articles</div>
            <div style={statRow}>
              <span style={{ color: 'var(--color-success)' }}>{blog.published} Published</span>
              <span style={{ color: 'var(--color-warning)' }}>{blog.drafts} Drafts</span>
            </div>
          </Card>
        )}
        {notes && (
          <Card padding="lg">
            <div style={cardLabel}>Notes</div>
            <div style={cardNumber}>{notes.total}</div>
            <div style={cardSublabel}>Notes</div>
            <div style={statRow}>
              <span style={{ color: 'var(--color-success)' }}>{notes.published} Published</span>
              <span style={{ color: 'var(--color-warning)' }}>{notes.drafts} Drafts</span>
            </div>
          </Card>
        )}
        {drafts !== null && (
          <Card padding="lg">
            <div style={cardLabel}>Drafts</div>
            <div style={cardNumber}>{drafts}</div>
            <div style={cardSublabel}>Awaiting publish</div>
          </Card>
        )}
      </div>

      <div style={sectionTitle}>Quick actions</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
        <button disabled title="Coming in Phase 3" style={disabledButtonStyle}>+ New Article</button>
        <button disabled title="Coming in Phase 3" style={disabledButtonStyle}>+ New Note</button>
        <button disabled title="Coming in Phase 4" style={disabledButtonStyle}>Upload Media</button>
      </div>

      <div style={sectionTitle}>Recent activity</div>
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
          title="No recent activity"
          description="Activity log entries will appear here once you start publishing. (Activity endpoint arrives in Phase 6.)"
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
