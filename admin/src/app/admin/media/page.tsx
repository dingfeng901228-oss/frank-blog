'use client';

// src/app/admin/media/page.tsx — Phase 4 (Media Library)
// Per docs/CMS V2.md §十二 (grid + details) + §十三 (upload via click)
//
// Item 14 — the library grew four things:
//   - the alt text can be edited in place (it is stored on the media
//     row, so editing it here fixes every article that embeds the
//     image);
//   - the pixel dimensions are shown (read from the row, or measured
//     in the browser when the row has none);
//   - "被哪些文章引用" lists the articles that use the asset;
//   - the list can be filtered by upload date;
//   and a long file name shows its full name on hover.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { apiDelete, apiGet, apiPut, errorMessage } from '@/lib/cms/api-client';
import { formatDateTime } from '@/lib/cms/format';

interface MediaItem {
  id: number;
  filename: string;
  mime_type: string;
  size: number;
  r2_key: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  uploaded_by: number | null;
  created_at: string;
  updated_at: string;
}

interface UsagePost {
  id: number;
  collection: string;
  locale: string;
  slug: string;
  title: string;
  status: string;
}

const PAGE_SIZE = 20;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  // Item 14 — the alt-text editor and the usage panel.
  const [editingAlt, setEditingAlt] = useState<number | null>(null);
  const [altDraft, setAltDraft] = useState('');
  const [savingAlt, setSavingAlt] = useState(false);
  const [usageFor, setUsageFor] = useState<number | null>(null);
  const [usage, setUsage] = useState<UsagePost[] | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // The measured dimensions, for the rows that have none stored.
  const [measured, setMeasured] = useState<Record<number, { width: number; height: number }>>({});

  async function fetchMedia() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String((page - 1) * PAGE_SIZE));
      if (search) params.set('search', search);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const data = await apiGet<{ items: MediaItem[]; total: number }>(`/api/admin/media?${params}`);
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(data.total ?? 0);
    } catch (e: unknown) {
      setError(errorMessage(e, '媒体库加载失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, from, to]);

  /**
   * Item 14 — measure an image whose row has no stored dimensions.
   *
   * The dimensions are written back to the media row, so the next load
   * does not have to measure it again.
   */
  async function measure(item: MediaItem) {
    if (item.width && item.height) return;
    if (measured[item.id]) return;
    try {
      const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('could not load the image'));
        img.src = item.url;
      });
      setMeasured((prev) => ({ ...prev, [item.id]: dims }));
      await apiPut(`/api/admin/media/${item.id}`, {
        width: dims.width,
        height: dims.height,
      }).catch(() => undefined);
    } catch {
      /* the image could not be measured — the row keeps its empty size */
    }
  }

  async function handleUpload(file: File, alt: string) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('alt', alt);
      // Upload must use bare fetch + FormData (api-client forces JSON
      // Content-Type). Inline X-CSRF-Token from the cms_csrf cookie — same
      // pattern as image-upload.ts and PostEditor.handleRestoreRevision.
      const csrf = document.cookie.match(/(?:^|;\s*)cms_csrf=([^;]*)/)?.[1] ?? '';
      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
        headers: csrf ? { 'X-CSRF-Token': csrf } : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || '上传失败');
      }
      toast.show('媒体已上传', 'success');
      fetchMedia();
    } catch (e: unknown) {
      toast.show(errorMessage(e, '上传失败'), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number, filename: string) {
    if (!confirm(`确认删除「${filename}」？此操作不可撤销。`)) return;
    try {
      await apiDelete(`/api/admin/media/${id}`);
      toast.show('媒体已删除', 'success');
      fetchMedia();
    } catch (e: unknown) {
      toast.show(errorMessage(e, '删除失败'), 'error');
    }
  }

  async function saveAlt(item: MediaItem) {
    setSavingAlt(true);
    try {
      const updated = await apiPut<MediaItem>(`/api/admin/media/${item.id}`, { alt: altDraft });
      setItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, ...updated } : m)));
      setEditingAlt(null);
      toast.show('替代文本已保存', 'success');
    } catch (e: unknown) {
      toast.show(errorMessage(e, '保存失败'), 'error');
    } finally {
      setSavingAlt(false);
    }
  }

  async function toggleUsage(item: MediaItem) {
    if (usageFor === item.id) {
      setUsageFor(null);
      setUsage(null);
      return;
    }
    setUsageFor(item.id);
    setUsage(null);
    setUsageLoading(true);
    try {
      const data = await apiGet<{ items: UsagePost[] }>(`/api/admin/media/usage?id=${item.id}`);
      setUsage(Array.isArray(data.items) ? data.items : []);
    } catch (e: unknown) {
      toast.show(errorMessage(e, '引用查询失败'), 'error');
    } finally {
      setUsageLoading(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const alt = window.prompt('替代文本（描述这张图片）：', '') || '';
    handleUpload(file, alt);
    e.target.value = '';
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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

  const inputStyle: CSSProperties = {
    padding: 'var(--space-sm) var(--space-md)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'inherit',
    fontSize: 13,
  };

  const smallBtn: CSSProperties = {
    padding: '4px 8px',
    background: 'var(--color-surface-elevated)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const dangerBtn: CSSProperties = {
    ...smallBtn,
    background: 'none',
    border: 'none',
    color: 'var(--color-danger)',
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={titleStyle}>媒体库</h1>
          <p style={subStyle}>
            共 {total} 个文件 · 第 {page}/{totalPages} 页
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onFileChange}
            style={{ display: 'none' }}
          />
          <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? '上传中…' : '+ 上传'}
          </Button>
        </div>
      </div>

      {/* Filters — search + upload date range (item 14) */}
      <Card padding="md" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px', minWidth: 180 }}>
            <label style={labelStyle}>搜索</label>
            <input
              type="search"
              placeholder="按文件名或替代文本搜索"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              style={{ ...inputStyle, width: '100%' }}
              aria-label="搜索媒体"
            />
          </div>
          <div>
            <label style={labelStyle}>上传日期（起）</label>
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1); }}
              style={inputStyle}
              aria-label="上传开始日期"
            />
          </div>
          <div>
            <label style={labelStyle}>上传日期（止）</label>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1); }}
              style={inputStyle}
              aria-label="上传结束日期"
            />
          </div>
          {(from || to) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom('');
                setTo('');
                setPage(1);
              }}
            >
              清除日期
            </Button>
          )}
        </div>
      </Card>

      {error ? (
        <ErrorState
          title="加载媒体失败"
          description={error}
          action={
            <Button variant="primary" onClick={fetchMedia}>
              重试
            </Button>
          }
        />
      ) : loading ? (
        <MediaSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title="暂无媒体"
          description="上传第一张图片开始使用。"
          action={
            <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              + 上传
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {items.map((item) => {
            const dims = item.width && item.height
              ? { width: item.width, height: item.height }
              : measured[item.id];
            return (
              <Card key={item.id} padding="md">
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    background: 'var(--color-bg)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 12,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.alt}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    loading="lazy"
                    onLoad={() => measure(item)}
                  />
                </div>

                {/* Item 14 — the full name on hover. */}
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-primary)',
                    marginBottom: 4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-mono)',
                  }}
                  title={item.filename}
                >
                  {item.filename}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    fontFamily: 'var(--font-mono)',
                    marginBottom: 4,
                  }}
                >
                  {formatBytes(item.size)}
                  {dims ? ` · ${dims.width}×${dims.height}` : ''}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    fontFamily: 'var(--font-mono)',
                    marginBottom: 8,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatDateTime(item.created_at)}
                </div>

                {/* Item 14 — the alt text, editable in place. */}
                {editingAlt === item.id ? (
                  <div style={{ marginBottom: 8 }}>
                    <textarea
                      value={altDraft}
                      onChange={(e) => setAltDraft(e.target.value)}
                      placeholder="描述这张图片的内容"
                      style={{
                        ...inputStyle,
                        width: '100%',
                        minHeight: 56,
                        resize: 'vertical',
                        fontSize: 12,
                      }}
                      aria-label="替代文本"
                    />
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button style={smallBtn} onClick={() => saveAlt(item)} disabled={savingAlt}>
                        {savingAlt ? '保存中…' : '保存'}
                      </button>
                      <button style={smallBtn} onClick={() => setEditingAlt(null)}>
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 11,
                      color: item.alt ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                      marginBottom: 8,
                      minHeight: 28,
                      lineHeight: 1.4,
                    }}
                    title={item.alt || undefined}
                  >
                    {item.alt || '（未填写替代文本）'}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(item.url);
                      toast.show('URL 已复制', 'success');
                    }}
                    style={{ ...smallBtn, flex: 1 }}
                  >
                    复制 URL
                  </button>
                  <button
                    onClick={() => {
                      setEditingAlt(item.id);
                      setAltDraft(item.alt ?? '');
                    }}
                    style={smallBtn}
                  >
                    编辑 alt
                  </button>
                  <button
                    onClick={() => toggleUsage(item)}
                    style={smallBtn}
                    aria-expanded={usageFor === item.id}
                  >
                    被引用
                  </button>
                  <button onClick={() => handleDelete(item.id, item.filename)} style={dangerBtn}>
                    删除
                  </button>
                </div>

                {/* Item 14 — which articles use this asset. */}
                {usageFor === item.id && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                    {usageLoading ? (
                      <span style={{ color: 'var(--color-text-muted)' }}>查询中…</span>
                    ) : usage && usage.length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {usage.map((p) => (
                          <li key={p.id} style={{ marginBottom: 2 }}>
                            <a href={`/admin/${p.collection}/edit?id=${p.id}`}>
                              {p.title || p.slug}
                            </a>
                            <span style={{ color: 'var(--color-text-muted)', marginLeft: 4 }}>
                              /{p.locale}/
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>没有被任何文章引用</span>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
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

function MediaSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 220, borderRadius: 'var(--radius-md)' }} />
      ))}
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--color-text-muted)',
  marginBottom: 4,
  fontWeight: 500,
};
