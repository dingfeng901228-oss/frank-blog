'use client';

// src/app/admin/activity/page.tsx — Phase 6 (Activity log UI)
// Per docs/CMS V2.md §二十五 (Activity log — user / Published / Updated / Uploaded / Logged in)

import { useEffect, useState, type CSSProperties } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';

interface ActivityEntry {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  created_at: string;
}

interface ActivityResponse {
  items: ActivityEntry[];
}

function actionLabel(entry: ActivityEntry): string {
  switch (entry.action) {
    case 'login':
      return 'Logged in';
    case 'logout':
      return 'Logged out';
    case 'login_failed':
      return 'Failed login attempt';
    case 'publish_post':
      return `Published ${entry.resource_type === 'notes' ? 'note' : 'article'} #${entry.resource_id ?? ''}`;
    case 'unpublish_post':
      return `Unpublished ${entry.resource_type === 'notes' ? 'note' : 'article'} #${entry.resource_id ?? ''}`;
    case 'publish_post_failed':
      return `Failed to publish #${entry.resource_id ?? ''}`;
    case 'unpublish_post_failed':
      return `Failed to unpublish #${entry.resource_id ?? ''}`;
    default:
      return entry.action;
  }
}

function actionIcon(entry: ActivityEntry): string {
  switch (entry.action) {
    case 'login':
    case 'logout':
      return '•';
    case 'publish_post':
      return '✓';
    case 'unpublish_post':
      return '↻';
    case 'publish_post_failed':
    case 'unpublish_post_failed':
      return '!';
    default:
      return '·';
  }
}

function actionColor(entry: ActivityEntry): string {
  if (entry.action.includes('failed')) return 'var(--color-danger)';
  if (entry.action === 'publish_post') return 'var(--color-success)';
  return 'var(--color-text-muted)';
}

function formatRelativeTime(createdAt: string): string {
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
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivity() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/activity/recent?limit=30', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error?.message || 'Failed to fetch');
        }
        setItems(data.data.items);
      } catch (e: any) {
        setError(e.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchActivity();
  }, []);

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

  const itemStyle = (entry: ActivityEntry): CSSProperties => ({
    padding: 'var(--space-sm) 0',
    borderBottom: '1px solid var(--color-border)',
    fontSize: 13,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={titleStyle}>Activity</h1>
        <p style={subStyle}>{items.length} recent</p>
      </div>

      {error && <ErrorState title="Failed to load activity" description={error} />}

      {loading ? (
        <LoadingState message="Loading activity..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="No activity yet"
          description="Activity log entries appear here once you start publishing."
        />
      ) : (
        <Card padding="md">
          {items.map((entry, i) => (
            <div key={entry.id} style={{ ...itemStyle(entry), borderBottom: i < items.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
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
                  }}
                >
                  {actionIcon(entry)}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actionLabel(entry)}</span>
                {entry.username && (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                    @{entry.username}
                  </span>
                )}
              </span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 11, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                {formatRelativeTime(entry.created_at)}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
