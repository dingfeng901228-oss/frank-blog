'use client';

// src/components/admin/PostsList.tsx — Phase 2 (shared list component)
// Used by /admin/posts, /admin/blog, /admin/notes, /admin/drafts

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';

interface PostSummary {
  id: number;
  collection: string;
  locale: string;
  slug: string;
  title: string;
  status: string;
  published_at: string | null;
  updated_at: string;
  cover_image: string | null;
  is_featured: number;
}

interface PostsListResponse {
  posts: PostSummary[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface PostsListProps {
  title: string;
  defaultCollection?: string;
  defaultStatus?: string;
  newHref: string;
  newLabel?: string;
  // Base path for the Edit link — passed from the page so /admin/blog's
  // table goes to /admin/blog/edit?id=X (consistent with where the user
  // navigated from), and the all-posts /admin/drafts page can keep using
  // /admin/posts/edit.
  // Defaults to /admin/posts for backwards compatibility with links that
  // don't set it explicitly.
  editBasePath?: string;
}

const STATUS_COLOR: Record<string, string> = {
  published: 'var(--color-success)',
  archived: 'var(--color-text-muted)',
  draft: 'var(--color-warning)',
};

// Localization maps (English → 中文)
const LOCALE_LABEL: Record<string, string> = {
  ja: '日本語',
  zh: '中文',
  en: 'English',
};
const STATUS_LABEL: Record<string, string> = {
  published: '已发布',
  archived: '已归档',
  draft: '草稿',
};
const COLLECTION_LABEL: Record<string, string> = {
  posts: '博客',
  notes: '随笔',
};

export function PostsList({
  title,
  defaultCollection,
  defaultStatus,
  newHref,
  newLabel = '+ New',
  editBasePath = '/admin/posts',
}: PostsListProps) {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const [locale, setLocale] = useState('');
  const [status, setStatus] = useState(defaultStatus || '');
  const [collection, setCollection] = useState(defaultCollection || '');
  const [search, setSearch] = useState('');

  async function fetchPosts() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (locale) params.set('locale', locale);
      if (status) params.set('status', status);
      if (collection) params.set('collection', collection);
      if (search) params.set('search', search);
      params.set('page', String(page));
      const res = await fetch(`/api/admin/posts?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to fetch');
      }
      const list = data.data as PostsListResponse;
      setPosts(list.posts);
      setTotal(list.total);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, status, collection, page]);

  async function handleDelete(id: number, postTitle: string) {
    if (!confirm(`Delete "${postTitle}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/posts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Delete failed');
      }
      toast.show('Post deleted', 'success');
      fetchPosts();
    } catch (e: any) {
      toast.show(e.message || 'Delete failed', 'error');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / 20));

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  };

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

  const filterBar: CSSProperties = {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  };

  const selectStyle: CSSProperties = {
    padding: 'var(--space-sm) var(--space-md)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'inherit',
  };

  const inputStyle: CSSProperties = {
    ...selectStyle,
    flex: 1,
    minWidth: 200,
  };

  const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: 'var(--space-md)',
    fontSize: 11,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
    background: 'var(--color-surface-elevated)',
  };

  const tdStyle: CSSProperties = {
    padding: 'var(--space-md)',
    fontSize: 'var(--font-size-sm)',
    borderBottom: '1px solid var(--color-border)',
  };

  const badgeStyle = (color: string): CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    border: `1px solid ${color}`,
    color,
    borderRadius: 'var(--radius-sm)',
  });

  return (
    <div>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>{title}</h1>
          <p style={subStyle}>
            {total} total · page {page} of {totalPages}
          </p>
        </div>
        <Link href={newHref} style={{ textDecoration: 'none' }}>
          <Button variant="primary">{newLabel}</Button>
        </Link>
      </div>

      <div style={filterBar}>
        <select value={locale} onChange={(e) => { setLocale(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">所有语言</option>
          <option value="ja">日本語</option>
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">所有状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="archived">已归档</option>
        </select>
        <select value={collection} onChange={(e) => { setCollection(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">所有集合</option>
          <option value="posts">博客</option>
          <option value="notes">随笔</option>
        </select>
        <input
          type="search"
          placeholder="按标题或 slug 搜索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchPosts(); } }}
          style={inputStyle}
        />
        <Button onClick={() => { setPage(1); fetchPosts(); }}>搜索</Button>
      </div>

      {error && <ErrorState title="加载失败" description={error} />}

      <Card padding="none">
        {loading ? (
          <LoadingState message="加载中…" />
        ) : posts.length === 0 ? (
          <EmptyState
            title={`No ${title.toLowerCase()} match these filters`}
            description="Try adjusting the filters or create your first one."
            action={
              <Link href={newHref} style={{ textDecoration: 'none' }}>
                <Button variant="primary">{newLabel}</Button>
              </Link>
            }
          />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Locale</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Collection</th>
                <th style={thStyle}>Updated</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const statusColor = STATUS_COLOR[post.status] || 'var(--color-text-muted)';
                return (
                  <tr key={post.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{post.title}</div>
                      <div style={{ color: 'var(--color-text-muted)', fontSize: 11, marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                        /{post.collection}/{post.slug}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <span style={badgeStyle('var(--color-border)')}>{LOCALE_LABEL[post.locale] || post.locale}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={badgeStyle(statusColor)}>{STATUS_LABEL[post.status] || post.status}</span>
                    </td>
                    <td style={tdStyle}>{COLLECTION_LABEL[post.collection] || post.collection}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {post.updated_at}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <Link
                        href={`${editBasePath}/edit?id=${post.id}`}
                        style={{ color: 'var(--color-primary)', fontSize: 12, marginRight: 12, textDecoration: 'none' }}
                      >
                        编辑
                      </Link>
                      <a
                        href={`/${post.locale}/${post.collection === 'notes' ? 'notes' : 'blog'}/${post.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--color-primary)', fontSize: 12, marginRight: 12, textDecoration: 'none' }}
                      >
                        查看
                      </a>
                      <button
                        onClick={() => handleDelete(post.id, post.title)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-danger)',
                          fontSize: 12,
                          fontFamily: 'inherit',
                        }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>← 上一页</Button>
          <span style={{ padding: 'var(--space-sm) var(--space-md)', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
            {page} / {totalPages}
          </span>
          <Button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>下一页 →</Button>
        </div>
      )}
    </div>
  );
}
