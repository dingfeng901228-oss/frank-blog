'use client';

// src/components/admin/CoverImagePicker.tsx — Phase 11b
// Browse the Media Library to pick a cover image, instead of pasting a URL.
// Modal with a responsive thumbnail grid, plus an inline "上传新图" button
// that uploads via the existing image-upload helper and adds the new image
// to the grid without forcing the user to re-open.

import { useEffect, useRef, useState, type CSSProperties, type ChangeEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { LoadingState } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiGet } from '@/lib/cms/api-client';
import { uploadImageFile, validateImageFile } from '@/lib/image-upload';

interface MediaItem {
  id: number;
  filename: string;
  url: string;
  alt: string;
  mime_type: string;
  width: number | null;
  height: number | null;
}

interface CoverImagePickerProps {
  open: boolean;
  onClose: () => void;
  /**
   * Called when the user picks an image. Receives the full MediaItem so
   * the caller has access to alt text and filename — useful for callers
   * that insert markdown into a post body (the alt should round-trip
   * into the rendered image). Callers that only need the URL can read
   * `item.url`.
   */
  onSelect: (item: MediaItem) => void;
  /** When the user picks something AND closes. Optional — used to also
   *  keep the URL for callers that want a side-effect on close. */
  currentValue?: string;
}

const PAGE_SIZE = 60;

export function CoverImagePicker({
  open,
  onClose,
  onSelect,
  currentValue,
}: CoverImagePickerProps) {
  const toast = useToast();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', '0');
      if (search) params.set('search', search);
      const data = await apiGet<{ items: MediaItem[]; total: number }>(
        `/api/admin/media?${params}`
      );
      // Show only images — videos/PDFs etc. don't make sense as covers.
      setItems(data.items.filter((m) => m.mime_type.startsWith('image/')));
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so picking the same file again still triggers onChange.
    e.target.value = '';
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      toast.show(validationError, 'error');
      return;
    }

    setUploading(true);
    try {
      const image = await uploadImageFile(file, '');
      // Insert at the front so the user sees their freshly uploaded image first.
      setItems((prev) => [
        {
          id: image.id,
          filename: image.filename,
          url: image.url,
          alt: image.alt,
          mime_type: file.type,
          width: image.width,
          height: image.height,
        },
        ...prev,
      ]);
      // Auto-select the newly uploaded image — common workflow is
      // "I just dragged in an image, of course I want to use it".
      onSelect({
        id: image.id,
        filename: image.filename,
        url: image.url,
        alt: image.alt,
        mime_type: file.type,
        width: image.width,
        height: image.height,
      });
      toast.show('已上传并选中', 'success');
    } catch (e: any) {
      toast.show(e.message || '上传失败', 'error');
    } finally {
      setUploading(false);
    }
  }

  function handleSelect(item: MediaItem) {
    onSelect(item);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabel="选择封面图">
      {/* Override Modal's narrow default width — we need room for the grid. */}
      <div style={wideDialogStyle}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>
            选择封面图
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', color: 'var(--color-text-muted)',
              fontSize: 22, cursor: 'pointer', lineHeight: 1,
            }}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* Toolbar: search + upload */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            type="search"
            placeholder="按文件名搜索…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '上传中…' : '+ 上传新图'}
          </Button>
        </div>

        {/* Body */}
        {loading && <LoadingState message="加载媒体中…" />}
        {error && (
          <p style={{ color: 'var(--color-danger)', fontSize: 13, padding: 16 }}>
            {error}
          </p>
        )}
        {!loading && !error && items.length === 0 && (
          <EmptyState
            title={search ? '没有匹配的图片' : '媒体库还是空的'}
            description={search ? '试试别的关键词。' : '点击右上角「+ 上传新图」添加你的第一张图。'}
          />
        )}
        {!loading && !error && items.length > 0 && (
          <div style={gridStyle}>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item)}
                style={{
                  ...tileStyle,
                  borderColor:
                    currentValue === item.url
                      ? 'var(--color-primary)'
                      : 'var(--color-border)',
                  outline: currentValue === item.url ? '2px solid var(--color-primary)' : 'none',
                  outlineOffset: currentValue === item.url ? '-2px' : '0',
                }}
                title={item.filename}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.alt || item.filename}
                  loading="lazy"
                  style={thumbStyle}
                />
                <div style={labelStyle}>{item.filename}</div>
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'right' }}>
          共 {items.length} 张图片
        </div>
      </div>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────
// Inline styles (kept colocated — matches sibling component style)
// ──────────────────────────────────────────────────────────────

// Override Modal's maxWidth:500 with a wider canvas. 900px fits a 4-col
// grid comfortably on desktop, gracefully falls back to 2-3 cols on smaller
// viewports via auto-fill.
const wideDialogStyle: CSSProperties = {
  width: '90vw',
  maxWidth: 900,
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 12,
  overflowY: 'auto',
  maxHeight: '60vh',
  padding: 4,
};

const tileStyle: CSSProperties = {
  position: 'relative',
  padding: 0,
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  overflow: 'hidden',
  transition: 'border-color 0.15s',
  fontFamily: 'inherit',
};

const thumbStyle: CSSProperties = {
  width: '100%',
  height: 100,
  objectFit: 'cover',
  display: 'block',
  background: 'var(--color-surface-elevated)',
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--color-text-secondary)',
  padding: '6px 8px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textAlign: 'left',
};
