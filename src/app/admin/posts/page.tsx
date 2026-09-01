// src/app/admin/posts/page.tsx
// Admin posts list — filter by locale/status/collection, edit/delete actions
'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/cms/api-client';

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

export default function PostsListPage() {
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [locale, setLocale] = useState('');
  const [status, setStatus] = useState('');
  const [collection, setCollection] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

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
      const data = await apiGet<PostsListResponse>(`/api/admin/posts?${params}`);
      setPosts(data.posts);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPosts();
  }, [locale, status, collection, page]);

  async function handleDelete(id: number, title: string) {
    if (!confirm(`Delete post "${title}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/admin/posts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      fetchPosts();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <Link href="/admin" style={backLinkStyle}>← Dashboard</Link>
            <h1 style={{ fontSize: 28, fontWeight: 500, fontFamily: 'Georgia, serif', marginTop: 8 }}>
              Posts
            </h1>
            <p style={{ fontSize: 12, color: '#707080', marginTop: 4 }}>
              {total} total · page {page} of {Math.max(1, totalPages)}
            </p>
          </div>
          <Link href="/admin/posts/new" style={primaryButtonStyle}>
            + New Post
          </Link>
        </div>

        {/* Filters */}
        <div style={filterBarStyle}>
          <select value={locale} onChange={(e) => { setLocale(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="">All locales</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <select value={collection} onChange={(e) => { setCollection(e.target.value); setPage(1); }} style={selectStyle}>
            <option value="">All collections</option>
            <option value="posts">Posts</option>
            <option value="notes">Notes</option>
          </select>
          <input
            type="search"
            placeholder="Search title or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchPosts(); } }}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => { setPage(1); fetchPosts(); }} style={secondaryButtonStyle}>
            Search
          </button>
        </div>

        {/* Error */}
        {error && <p style={{ color: '#ef4444', marginBottom: 16 }}>{error}</p>}

        {/* Table */}
        <div style={tableStyle}>
          {loading ? (
            <p style={{ padding: 24, color: '#707080' }}>Loading…</p>
          ) : posts.length === 0 ? (
            <p style={{ padding: 24, color: '#707080', textAlign: 'center' }}>No posts match these filters.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1E1E2E', background: '#14141C' }}>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Locale</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Collection</th>
                  <th style={thStyle}>Updated</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} style={{ borderBottom: '1px solid #1E1E2E' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{post.title}</div>
                      <div style={{ color: '#707080', fontSize: 11, marginTop: 2 }}>/{post.collection}/{post.slug}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={badgeStyle}>{post.locale}</span>
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={post.status} />
                    </td>
                    <td style={tdStyle}>{post.collection}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: '#707080' }}>{post.updated_at}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <Link href={`/admin/posts/${post.id}`} style={actionLinkStyle}>Edit</Link>
                      <a href={`/${post.locale}/${post.collection === 'notes' ? 'notes' : 'blog'}/${post.slug}`} target="_blank" rel="noreferrer" style={actionLinkStyle}>View</a>
                      <button onClick={() => handleDelete(post.id, post.title)} style={{ ...actionLinkStyle, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ ...secondaryButtonStyle, opacity: page === 1 ? 0.5 : 1 }}
            >
              ← Previous
            </button>
            <span style={{ padding: '8px 16px', color: '#707080', alignSelf: 'center' }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ ...secondaryButtonStyle, opacity: page === totalPages ? 0.5 : 1 }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'published' ? '#10b981' :
    status === 'archived' ? '#707080' :
    '#f59e0b'; // draft
  return (
    <span style={{ ...badgeStyle, color, borderColor: color }}>
      {status}
    </span>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#0A0A0F',
  color: '#E8E8EC',
  padding: '40px 24px',
  fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 24,
};

const backLinkStyle: CSSProperties = {
  fontSize: 12,
  color: '#707080',
  textDecoration: 'none',
};

const primaryButtonStyle: CSSProperties = {
  padding: '10px 20px',
  backgroundColor: '#00D4C8',
  color: '#0A0A0F',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
};

const secondaryButtonStyle: CSSProperties = {
  padding: '8px 16px',
  backgroundColor: '#1E1E2E',
  color: '#E8E8EC',
  border: 'none',
  borderRadius: 8,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const filterBarStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  marginBottom: 16,
  flexWrap: 'wrap',
};

const selectStyle: CSSProperties = {
  padding: '8px 12px',
  backgroundColor: '#14141C',
  border: '1px solid #1E1E2E',
  borderRadius: 8,
  color: '#E8E8EC',
  fontSize: 13,
  fontFamily: 'inherit',
};

const inputStyle: CSSProperties = {
  padding: '8px 12px',
  backgroundColor: '#14141C',
  border: '1px solid #1E1E2E',
  borderRadius: 8,
  color: '#E8E8EC',
  fontSize: 13,
  fontFamily: 'inherit',
  minWidth: 200,
};

const tableStyle: CSSProperties = {
  backgroundColor: '#14141C',
  border: '1px solid #1E1E2E',
  borderRadius: 12,
  overflow: 'hidden',
};

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '12px 16px',
  fontSize: 11,
  color: '#707080',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontWeight: 500,
};

const tdStyle: CSSProperties = {
  padding: '12px 16px',
};

const badgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  fontSize: 11,
  fontFamily: 'monospace',
  border: '1px solid #1E1E2E',
  borderRadius: 4,
};

const actionLinkStyle: CSSProperties = {
  fontSize: 12,
  color: '#00D4C8',
  textDecoration: 'none',
  marginLeft: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
