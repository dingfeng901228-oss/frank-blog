'use client';

// src/components/admin/PostsList.tsx
// The article list for 博客 / 随笔 / 草稿箱.
//
// Item 7 — one row per ARTICLE. The Chinese, Japanese and English
// versions of the same article used to be three separate rows, sorted
// by update time, so they drifted apart and the same article appeared
// three times. The list now asks the API for `group=article` and shows
// one row per article with the language versions as small chips inside
// the row. The search and the status / language / collection filters
// are unchanged.
//
// Item 6 — the list carries the article's category, so the table has
// a 分类 column.
//
// Item 8 — the bulk bar grew from "一键发布" to publish / archive /
// delete (with a second confirmation) / move category / export the
// selection as Markdown or JSON.
//
// Item 12 — sorting by update time or publish time, a page-size
// setting and a jump-to-page box. There is deliberately NO view-count
// column: the site has no view statistics, and inventing them would
// be fake data.
//
// Item 11 — the whole interface is Chinese, including the pagination
// line ("共 38 条 · 第 1/2 页") and the empty states.

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { apiGet, apiPost, errorMessage } from '@/lib/cms/api-client';
import {
  formatCollection,
  formatDateTime,
  formatLocale,
  formatPagination,
  formatStatus,
} from '@/lib/cms/format';

export interface PostLocale {
  id: number;
  locale: string;
  title: string;
  status: string;
  updated_at: string;
  published_at: string | null;
  cover_image: string | null;
  auto_translated: number | null;
  scheduled_at: string | null;
}

export interface PostRow {
  id: number | null;
  collection: string;
  slug: string;
  title: string;
  status: string;
  updated_at: string;
  published_at: string | null;
  created_at: string;
  category_id: number | null;
  category_name: string | null;
  cover_image: string | null;
  locales: PostLocale[];
}

interface Category {
  id: number;
  name: string;
  collection: string;
}

const LOCALE_LABELS: Record<string, string> = { ja: '日', zh: '中', en: '英' };

/**
 * The edit route for a collection.
 *
 * The API calls the blog collection "posts", but the admin's edit route
 * for it is /admin/blog/edit — /admin/posts/edit is only the legacy
 * alias.
 */
function editBaseFor(collection: string): string {
  return collection === 'notes' ? '/admin/notes' : '/admin/blog';
}

export function PostsList({
  collection,
  title,
  showStatusFilter = true,
}: {
  collection: 'posts' | 'notes' | 'drafts';
  title: string;
  showStatusFilter?: boolean;
}) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [localeFilter, setLocaleFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  // Item 12 — sorting.
  const [sort, setSort] = useState('updated_at');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [pageInput, setPageInput] = useState('1');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [moveCategoryId, setMoveCategoryId] = useState('');
  const toast = useToast();

  const apiCollection = collection === 'drafts' ? 'posts' : collection;

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        // Item 7 — one row per article, with the locales nested.
        group: 'article',
        page: String(page),
        limit: String(limit),
        sort,
        order,
      });
      if (collection === 'drafts') {
        // The draft box shows the drafts of BOTH collections.
        params.set('status', 'draft');
      } else {
        params.set('collection', apiCollection);
        if (statusFilter) params.set('status', statusFilter);
      }
      if (localeFilter) params.set('locale', localeFilter);
      if (search.trim()) params.set('search', search.trim());
      if (categoryFilter) params.set('category_id', categoryFilter);

      const data = await apiGet<{ posts: PostRow[]; total: number }>(
        `/api/admin/posts?${params}`
      );
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setTotal(data.total ?? 0);
      setSelected(new Set());
    } catch (e: unknown) {
      setError(errorMessage(e, '文章列表加载失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }, [apiCollection, collection, page, limit, sort, order, statusFilter, localeFilter, search, categoryFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    apiGet<{ items: Category[] }>('/api/admin/categories')
      .then((data) => setCategories(Array.isArray(data.items) ? data.items : []))
      .catch(() => setCategories([]));
  }, []);

  const rowKey = useCallback((row: PostRow) => `${row.collection}:${row.slug}`, []);

  const allSelected = posts.length > 0 && posts.every((p) => selected.has(rowKey(p)));

  function toggleRow(row: PostRow) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = rowKey(row);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (allSelected) return new Set();
      const next = new Set(prev);
      for (const p of posts) next.add(rowKey(p));
      return next;
    });
  }

  /**
   * Every language version of the selected articles.
   *
   * Item 8 — a bulk action applies to the whole article, not to one
   * language version: publishing only the Japanese version of an
   * article would leave the site inconsistent.
   */
  const selectedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of posts) {
      if (!selected.has(rowKey(row))) continue;
      for (const l of row.locales) ids.add(l.id);
      if (row.id) ids.add(row.id);
    }
    return Array.from(ids);
  }, [posts, selected]);

  const selectedArticleCount = useMemo(
    () => posts.filter((p) => selected.has(rowKey(p))).length,
    [posts, selected]
  );

  async function runBulk(
    action: 'publish' | 'archive' | 'delete' | 'move_category',
    label: string
  ) {
    if (selectedIds.length === 0) {
      toast.show('请先选择文章', 'error');
      return;
    }
    if (action === 'delete') {
      // Item 8 — the delete needs a second confirmation, and it says
      // exactly what is about to be destroyed.
      const ok = confirm(
        `确认删除选中的 ${selectedArticleCount} 篇文章（共 ${selectedIds.length} 个语言版本）？\n\n此操作不可撤销。`
      );
      if (!ok) return;
      const again = confirm(`再次确认：${selectedArticleCount} 篇文章将被永久删除。`);
      if (!again) return;
    }
    setBulkRunning(true);
    try {
      const data = await apiPost<{ done: number; skipped: any[] }>('/api/admin/posts/bulk', {
        ids: selectedIds,
        action,
        category_id: action === 'move_category' ? Number(moveCategoryId) : undefined,
      });
      toast.show(`${label}完成：处理了 ${data.done} 条`, 'success');
      fetchPosts();
    } catch (e: unknown) {
      toast.show(errorMessage(e, `${label}失败`), 'error');
    } finally {
      setBulkRunning(false);
    }
  }

  /**
   * Item 8 — export the selection as Markdown or JSON.
   *
   * The list endpoint does not carry the article bodies, so each
   * selected version is fetched and the file is assembled in the
   * browser.
   */
  async function exportSelected(format: 'markdown' | 'json') {
    if (selectedIds.length === 0) {
      toast.show('请先选择文章', 'error');
      return;
    }
    setBulkRunning(true);
    try {
      const details = await Promise.all(
        selectedIds.map((id) => apiGet<any>(`/api/admin/posts/${id}`))
      );
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'json') {
        downloadBlob(
          JSON.stringify({ exported_at: new Date().toISOString(), posts: details }, null, 2),
          `frank-blog-${stamp}.json`,
          'application/json'
        );
      } else {
        const md = details
          .map((p: any) => {
            const tags = (() => {
              try {
                const t = JSON.parse(p.tags || '[]');
                return Array.isArray(t) ? t.join('、') : '';
              } catch {
                return '';
              }
            })();
            return [
              `# ${p.title}`,
              '',
              `- 集合：${formatCollection(p.collection)}`,
              `- 语言：${formatLocale(p.locale)}`,
              `- slug：${p.slug}`,
              `- 状态：${formatStatus(p.status)}`,
              `- 发布时间：${formatDateTime(p.published_at)}`,
              `- 标签：${tags || '—'}`,
              '',
              p.description_text || '',
              '',
              p.content || '',
            ].join('\n');
          })
          .join('\n\n---\n\n');
        downloadBlob(md, `frank-blog-${stamp}.md`, 'text/markdown');
      }
      toast.show('导出已开始', 'success');
    } catch (e: unknown) {
      toast.show(errorMessage(e, '导出失败'), 'error');
    } finally {
      setBulkRunning(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / limit));
  const collectionLabel = collection === 'notes' ? '随笔' : collection === 'drafts' ? '草稿箱' : '博客';

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>
            {title}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            {formatPagination(total, page, limit)}
          </p>
        </div>
        <Link href={`/admin/${apiCollection}/new`} style={{ textDecoration: 'none' }}>
          <Button variant="primary">
            + 新建{collection === 'notes' ? '随笔' : '文章'}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card padding="md" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 160 }}>
            <label style={labelStyle}>搜索</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  fetchPosts();
                }
              }}
              placeholder="搜索标题或 slug"
              style={{ ...inputStyle, width: '100%' }}
              aria-label="搜索文章"
            />
          </div>
          {showStatusFilter && (
            <div>
              <label style={labelStyle}>状态</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                style={inputStyle}
                aria-label="状态筛选"
              >
                <option value="">全部状态</option>
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
                <option value="archived">已归档</option>
              </select>
            </div>
          )}
          <div>
            <label style={labelStyle}>语言</label>
            <select
              value={localeFilter}
              onChange={(e) => {
                setLocaleFilter(e.target.value);
                setPage(1);
              }}
              style={inputStyle}
              aria-label="语言筛选"
            >
              <option value="">全部语言</option>
              <option value="ja">日文</option>
              <option value="zh">中文</option>
              <option value="en">英文</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>分类</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              style={inputStyle}
              aria-label="分类筛选"
            >
              <option value="">全部分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>排序</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                style={inputStyle}
                aria-label="排序字段"
              >
                <option value="updated_at">按更新时间</option>
                <option value="published_at">按发布时间</option>
                <option value="created_at">按创建时间</option>
                <option value="title">按标题</option>
              </select>
              <select
                value={order}
                onChange={(e) => {
                  setOrder(e.target.value as 'asc' | 'desc');
                  setPage(1);
                }}
                style={inputStyle}
                aria-label="排序方向"
              >
                <option value="desc">降序</option>
                <option value="asc">升序</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>每页条数</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              style={inputStyle}
              aria-label="每页条数"
            >
              {[20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} 条
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Item 8 — the bulk bar. */}
      {selectedArticleCount > 0 && (
        <Card padding="md" style={{ marginBottom: 16, borderColor: 'var(--color-primary)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginRight: 4 }}>
              已选择 {selectedArticleCount} 篇文章（{selectedIds.length} 个语言版本）
            </span>
            <Button variant="primary" size="sm" disabled={bulkRunning} onClick={() => runBulk('publish', '批量发布')}>
              一键发布
            </Button>
            <Button variant="secondary" size="sm" disabled={bulkRunning} onClick={() => runBulk('archive', '批量归档')}>
              批量归档
            </Button>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <select
                value={moveCategoryId}
                onChange={(e) => setMoveCategoryId(e.target.value)}
                style={inputStyle}
                aria-label="移动到分类"
              >
                <option value="">选择分类…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                disabled={bulkRunning || !moveCategoryId}
                onClick={() => runBulk('move_category', '批量移动分类')}
              >
                移动分类
              </Button>
            </div>
            <Button variant="secondary" size="sm" disabled={bulkRunning} onClick={() => exportSelected('markdown')}>
              导出 Markdown
            </Button>
            <Button variant="secondary" size="sm" disabled={bulkRunning} onClick={() => exportSelected('json')}>
              导出 JSON
            </Button>
            <Button variant="danger" size="sm" disabled={bulkRunning} onClick={() => runBulk('delete', '批量删除')}>
              批量删除
            </Button>
            <button style={linkButtonStyle} onClick={() => setSelected(new Set())}>
              取消选择
            </button>
          </div>
        </Card>
      )}

      {error ? (
        <ErrorState
          title="加载文章列表失败"
          description={error}
          action={
            <Button variant="primary" onClick={fetchPosts}>
              重试
            </Button>
          }
        />
      ) : loading ? (
        <ListSkeleton />
      ) : posts.length === 0 ? (
        // Item 11 — the old copy was "No 草稿箱 match these filters".
        <EmptyState
          title="没有符合条件的文章"
          description={search || statusFilter || localeFilter || categoryFilter
            ? '换个筛选条件试试。'
            : '这里还没有文章。'}
          action={
            <Link href={`/admin/${apiCollection}/new`} style={{ textDecoration: 'none' }}>
              <Button variant="primary">+ 新建{collection === 'notes' ? '随笔' : '文章'}</Button>
            </Link>
          }
        />
      ) : (
        <Card padding="none">
          <div className="admin-table-scroll">
            {/* A minimum width keeps the columns readable on a phone:
                the table scrolls inside its own box instead of squeezing
                the text into two lines. */}
            <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="全选"
                    />
                  </th>
                  <th style={thStyle}>标题</th>
                  <th style={thStyle}>分类</th>
                  <th style={thStyle}>状态</th>
                  <th style={thStyle}>更新时间</th>
                  <th style={thStyle}>发布时间</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => {
                  const key = rowKey(post);
                  const isSelected = selected.has(key);
                  return (
                    <tr key={key} style={isSelected ? { background: 'var(--color-surface-elevated)' } : undefined}>
                      <td style={tdStyle}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(post)}
                          aria-label={`选择 ${post.title}`}
                        />
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                            {post.title || `（无标题）${post.slug}`}
                          </span>
                          {/* Item 7 — the language versions live inside the row. */}
                          <span style={{ display: 'inline-flex', gap: 4 }}>
                            {post.locales.map((l) => (
                              <Link
                                key={l.id}
                                href={`${editBaseFor(post.collection)}/edit?id=${l.id}`}
                                title={`${formatLocale(l.locale)}：${l.title}（${formatStatus(l.status)}）`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '1px 6px',
                                  fontSize: 11,
                                  borderRadius: 'var(--radius-sm)',
                                  textDecoration: 'none',
                                  border: '1px solid var(--color-border)',
                                  color:
                                    l.locale === 'ja'
                                      ? 'var(--color-primary)'
                                      : 'var(--color-text-secondary)',
                                  background: 'var(--color-surface-elevated)',
                                }}
                              >
                                {LOCALE_LABELS[l.locale] ?? l.locale}
                              </Link>
                            ))}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          /{post.collection}/{post.slug}
                        </div>
                      </td>
                      <td style={tdStyle}>{post.category_name || '—'}</td>
                      <td style={tdStyle}>
                        <span style={{ color: statusColor(post.status) }}>{formatStatus(post.status)}</span>
                        {post.locales.some((l) => l.scheduled_at) && (
                          <span
                            title="已设置定时发布"
                            style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-warning)' }}
                          >
                            定时
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {formatDateTime(post.updated_at)}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11, whiteSpace: 'nowrap' }}>
                        {formatDateTime(post.published_at)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Link
                          href={`${editBaseFor(post.collection)}/edit?id=${post.locales[0]?.id ?? post.id}`}
                          style={{ ...linkButtonStyle, marginRight: 10 }}
                        >
                          编辑
                        </Link>
                        <button
                          style={{ ...linkButtonStyle, color: 'var(--color-danger)' }}
                          onClick={() => {
                            const first = post.locales[0];
                            if (!first) return;
                            if (!confirm(`确认删除文章「${post.title}」？此操作不可撤销。`)) return;
                            apiPost('/api/admin/posts/bulk', { ids: [first.id], action: 'delete' })
                              .then(() => {
                                toast.show('文章已删除', 'success');
                                fetchPosts();
                              })
                              .catch((e) => toast.show(errorMessage(e, '删除失败'), 'error'));
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
          </div>
        </Card>
      )}

      {/* Item 12 — pagination with a jump box. */}
      {total > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 12,
            color: 'var(--color-text-muted)',
          }}
        >
          <span>{formatPagination(total, page, limit)}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                setPageInput(String(Math.max(1, page - 1)));
              }}
            >
              上一页
            </Button>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              第 {page}/{pages} 页
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= pages}
              onClick={() => {
                setPage((p) => Math.min(pages, p + 1));
                setPageInput(String(Math.min(pages, page + 1)));
              }}
            >
              下一页
            </Button>
            <span>跳至</span>
            <input
              type="number"
              min={1}
              max={pages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const n = Math.min(pages, Math.max(1, Number(pageInput) || 1));
                  setPage(n);
                  setPageInput(String(n));
                }
              }}
              style={{ ...inputStyle, width: 70 }}
              aria-label="跳转到页码"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const n = Math.min(pages, Math.max(1, Number(pageInput) || 1));
                setPage(n);
                setPageInput(String(n));
              }}
            >
              跳转
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function statusColor(status: string): string {
  if (status === 'published') return 'var(--color-success)';
  if (status === 'draft') return 'var(--color-warning)';
  return 'var(--color-text-muted)';
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Item 17 — a skeleton in the shape of the table. */
function ListSkeleton() {
  return (
    <Card padding="md">
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div className="skeleton" style={{ height: 14, width: 14, borderRadius: 3 }} />
          <div className="skeleton" style={{ height: 14, width: `${35 + (i % 3) * 12}%` }} />
          <div className="skeleton" style={{ height: 14, width: 90, marginLeft: 'auto' }} />
        </div>
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
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: 'var(--space-md)',
  fontSize: 'var(--font-size-sm)',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'top',
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
