'use client';

// src/app/admin/media/page.tsx — Phase 4 (Media Library)
// Per docs/CMS V2.md §十二 (grid + details) + §十三 (upload via click)

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';

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

interface MediaListResponse {
  items: MediaItem[];
  total: number;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function fetchMedia() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String((page - 1) * PAGE_SIZE));
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/media?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to fetch');
      }
      setItems(data.data.items);
      setTotal(data.data.total);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search]);

  async function handleUpload(file: File, alt: string) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('alt', alt);
      const res = await fetch('/api/admin/media/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || '上传失败');
      }
      toast.show('媒体已上传', 'success');
      fetchMedia();
    } catch (e: any) {
      toast.show(e.message || '上传失败', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number, filename: string) {
    if (!confirm(`确认删除「${filename}」？此操作不可撤销。`)) return;
    try {
      const res = await fetch(`/api/admin/media/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Delete failed');
      }
      toast.show('媒体已删除', 'success');
      fetchMedia();
    } catch (e: any) {
      toast.show(e.message || '删除失败', 'error');
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const alt = window.prompt('Alt text (describe the image):', '') || '';
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={titleStyle}>媒体库</h1>
          <p style={subStyle}>
            {total} 张 · 第 {page} / {totalPages} 页
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

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="search"
          placeholder="按文件名或 alt 搜索..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ ...inputStyle, width: '100%', maxWidth: 400 }}
        />
      </div>

      {error && <ErrorState title="加载媒体失败" description={error} />}

      {/* Grid */}
      {loading ? (
        <LoadingState message="加载媒体中…" />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          {items.map((item) => (
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
                />
              </div>
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
                  marginBottom: 8,
                }}
              >
                {formatBytes(item.size)} · {item.created_at.split(' ')[0]}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
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
                  onClick={() => handleDelete(item.id, item.filename)}
                  style={dangerBtn}
                >
                  删除
                </button>
              </div>
            </Card>
          ))}
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
