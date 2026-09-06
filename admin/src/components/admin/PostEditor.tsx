'use client';

// src/components/admin/PostEditor.tsx — Phase 3 + Phase 6 unificaiton
// Shared editor for Blog + Notes new + edit pages.
// Used by /admin/blog/new, /admin/notes/new, /admin/blog/edit, /admin/notes/edit
// Per docs/CMS V2.md §十 (Editor UX) + §二十二 (Collection auto-determined by route) + §二十 (Preview uses Markdown.tsx)
// Phase 6 parity: cover_image / tags / is_featured / revision drawer / autosave /
// conflict detection / delete button all work in BOTH new + edit modes. New mode
// stays in the same component instance after first POST so the same fields/buttons
// become live (revisions/delete/etc.) without leaving the page.

import { useEffect, useRef, useState, type CSSProperties, type ClipboardEvent, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import Markdown from '@/components/Markdown';
import { useToast } from '@/components/ui/Toast';
import { extractImageFile, uploadImageFile, buildImageMarkdown, insertAtCursor } from '@/lib/image-upload';
import { apiGet, apiPatch, apiPost, apiPut, apiDelete } from '@/lib/cms/api-client';
import { CoverImagePicker } from '@/components/admin/CoverImagePicker';

type Tab = 'write' | 'preview';
type Status = 'draft' | 'published' | 'archived';
type Locale = 'ja' | 'zh' | 'en';
type Collection = 'posts' | 'notes'; // API collection value (blog articles use 'posts')

export interface PostEditorProps {
  collection: Collection;
  initialPost?: {
    id: number;
    title: string;
    slug: string;
    description_text: string;
    content: string;
    cover_image: string | null;
    tags: string[];
    is_featured: boolean;
    locale: Locale;
    status: Status;
    published_at: string | null;
    updated_at: string;
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function safeParseTags(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

export function PostEditor({ collection, initialPost }: PostEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!initialPost;

  // When a new post is first saved, we keep the same component instance and
  // transition to "edit" state (so revision history, delete, etc. light up
  // immediately — same UX as the legacy edit page).
  const [savedPostId, setSavedPostId] = useState<number | null>(initialPost?.id ?? null);
  const effectiveIsEdit = isEdit || savedPostId !== null;

  const [title, setTitle] = useState(initialPost?.title || '');
  const [slug, setSlug] = useState(initialPost?.slug || '');
  const [description, setDescription] = useState(initialPost?.description_text || '');
  const [content, setContent] = useState(initialPost?.content || '');
  const [coverImage, setCoverImage] = useState(initialPost?.cover_image ?? '');
  const [tagsInput, setTagsInput] = useState(
    initialPost?.tags ? initialPost.tags.join(', ') : ''
  );
  const [isFeatured, setIsFeatured] = useState(initialPost?.is_featured ?? false);
  const [locale, setLocale] = useState<Locale>(initialPost?.locale || 'ja');
  const [status, setStatus] = useState<Status>(initialPost?.status || 'draft');
  const [publishedAt, setPublishedAt] = useState<string | null>(initialPost?.published_at ?? null);
  const [updatedAt, setUpdatedAt] = useState<string>(initialPost?.updated_at ?? '');
  const [tab, setTab] = useState<Tab>('write');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  // Phase 11b — toggle for the CoverImagePicker modal
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);

  // ── Phase A §19 — Auto-save state (edit mode only) ──
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoSavedSnapshot = useRef<string>('');

  // ── Phase A §26 — Revision drawer state (edit mode only) ──
  const [revisions, setRevisions] = useState<any[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  // ── Phase C1 §27 — Optimistic Lock conflict modal (edit mode only) ──
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string>('');

  // ── Phase B §13 ②③ — paste + drag/drop image upload ──
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  const postId = savedPostId ?? initialPost?.id ?? null;

  async function handleImageFile(file: File) {
    setUploadingImage(true);
    try {
      const image = await uploadImageFile(file, '');
      const md = buildImageMarkdown(image) + '\n';
      if (contentRef.current) {
        insertAtCursor(contentRef.current, md);
        // insertAtCursor dispatches 'input' event which React may not pick up — sync state directly
        setContent(contentRef.current.value);
      } else {
        setContent((c) => c + md);
      }
      toast.show('Image uploaded', 'success');
    } catch (e: any) {
      toast.show(e.message || 'Upload failed', 'error');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const file = extractImageFile(e.clipboardData);
    if (file) {
      e.preventDefault();
      await handleImageFile(file);
    }
  }

  function handleDragOver(e: DragEvent) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDraggingImage(true);
    }
  }

  function handleDragLeave() {
    setIsDraggingImage(false);
  }

  async function handleDrop(e: DragEvent) {
    const file = extractImageFile(e.dataTransfer);
    if (file) {
      e.preventDefault();
      setIsDraggingImage(false);
      await handleImageFile(file);
    }
  }

  // Auto-generate slug from title (only if user hasn't manually edited it)
  useEffect(() => {
    if (!slugTouched && title) {
      setSlug(slugify(title));
    }
  }, [title, slugTouched]);

  async function fetchRevisions() {
    if (postId === null) return;
    setRevisionsLoading(true);
    try {
      const data = await apiGet<{ items?: any[] }>(`/api/admin/posts/${postId}/revisions`);
      setRevisions(data?.items || []);
    } catch {
      setRevisions([]);
    } finally {
      setRevisionsLoading(false);
    }
  }

  async function refetchPost() {
    if (postId === null) return;
    try {
      const data = await apiGet<any>(`/api/admin/posts/${postId}`);
      setTitle(data.title);
      setSlug(data.slug);
      setDescription(data.description_text);
      setContent(data.content);
      setCoverImage(data.cover_image ?? '');
      setTagsInput(data.tags ? safeParseTags(data.tags).join(', ') : '');
      setIsFeatured(data.is_featured === 1);
      setLocale(data.locale);
      setStatus(data.status);
      setPublishedAt(data.published_at);
      setUpdatedAt(data.updated_at);
    } catch (e: any) {
      setError(e.message || 'Reload failed');
    }
  }

  // Load revisions once we have a postId (edit mode, or after first POST in new mode).
  useEffect(() => {
    if (postId !== null) {
      fetchRevisions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // ── Phase A §19 — Auto-save (edit mode only, debounced 2s, silent on failure) ──
  useEffect(() => {
    if (!effectiveIsEdit || postId === null) return;
    const snapshot = JSON.stringify({
      title,
      slug,
      content,
      description_text: description,
    });
    if (snapshot === lastAutoSavedSnapshot.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        setAutoSaving(true);
        await apiPatch(`/api/admin/posts/${postId}`, {
          title,
          slug,
          content,
          description_text: description,
        });
        lastAutoSavedSnapshot.current = snapshot;
        setAutoSavedAt(new Date().toLocaleTimeString());
      } catch {
        // Silent fail — user is still typing
      } finally {
        setAutoSaving(false);
      }
    }, 2000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, slug, content, description, effectiveIsEdit, postId]);

  function parseTags(): string[] {
    return tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
  }

  async function save(targetStatus: Status) {
    if (!title.trim() || !slug.trim() || !content.trim()) {
      setError('Title, slug, and content are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tags = parseTags();
      // Edit mode: PUT (full update) so slug/cover/tags/featured/etc. all persist.
      // New mode: POST to create, then transition into edit mode (no page reload).
      if (effectiveIsEdit && postId !== null) {
        await apiPut(`/api/admin/posts/${postId}`, {
          collection,
          locale,
          slug,
          title,
          description_text: description,
          content,
          cover_image: coverImage || null,
          tags,
          is_featured: isFeatured,
          status: targetStatus,
          loaded_updated_at: updatedAt,
        });
        await refetchPost();
        setStatus(targetStatus);
        toast.show(
          targetStatus === 'published'
            ? (isEdit ? 'Published' : 'Article published')
            : 'Draft saved',
          'success'
        );
      } else {
        const data = await apiPost<{ id: number }>('/api/admin/posts', {
          collection,
          locale,
          slug,
          title,
          description_text: description,
          content,
          cover_image: coverImage || null,
          tags,
          is_featured: isFeatured,
          status: targetStatus,
        });
        // Transition into edit mode in-place — URL stays the same, revisions
        // and other edit-only features light up without a navigation.
        setSavedPostId(data.id);
        toast.show(
          targetStatus === 'published' ? 'Article published' : 'Draft saved',
          'success'
        );
        // Refresh server-side timestamps by reloading the row.
        await refetchPost();
        // Update browser URL to the canonical edit route for shareability/bookmarks.
        const editBase = collection === 'notes' ? '/admin/notes' : '/admin/blog';
        router.replace(`${editBase}/edit?id=${data.id}`);
      }
    } catch (e: any) {
      const msg = e?.message || 'Save failed';
      if (e?.code === 'CONFLICT') {
        setConflictMessage(msg);
        setConflictOpen(true);
      } else {
        toast.show(msg, 'error');
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (postId === null) return;
    if (!confirm('确认删除？此操作不可撤销。')) return;
    try {
      await apiDelete(`/api/admin/posts/${postId}`);
      toast.show('已删除', 'success');
      const listHref = collection === 'notes' ? '/admin/notes' : '/admin/blog';
      router.push(listHref);
    } catch (e: any) {
      toast.show(`删除失败：${e.message}`, 'error');
    }
  }

  async function handleRestoreRevision(revisionId: number) {
    if (postId === null) return;
    if (!confirm('确认恢复此版本？当前内容将被覆盖。')) return;
    setRestoringId(revisionId);
    try {
      // Bare fetch: this endpoint isn't covered by api-client because the
      // version inside PostEditor predates the api-client refactor. Inline
      // X-CSRF-Token from the cms_csrf cookie (api-client does the same
      // thing internally via apiFetch).
      const csrfMatch = document.cookie.match(/(?:^|; )cms_csrf=([^;]*)/);
      const csrf = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';
      const res = await fetch(`/api/admin/posts/${postId}/revisions/${revisionId}/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || `Restore failed (HTTP ${res.status})`);
      }
      await refetchPost();
      await fetchRevisions();
      setDrawerOpen(false);
      toast.show('已恢复该版本', 'success');
    } catch (e: any) {
      toast.show(`恢复失败：${e.message}`, 'error');
    } finally {
      setRestoringId(null);
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: 'var(--space-sm) var(--space-md)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontFamily: 'inherit',
  };

  const labelStyle: CSSProperties = {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontFamily: 'var(--font-mono)',
    marginBottom: 6,
    display: 'block',
  };

  const isNotes = collection === 'notes';
  const listHref = `/admin/${isNotes ? 'notes' : 'blog'}`;
  const listLabel = isNotes ? '随笔' : '博客';
  const typeLabel = isNotes ? '随笔' : '文章';
  const newLabel = isNotes ? '新建随笔' : '新建文章';

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <Link href={listHref} style={{ fontSize: 12, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            ← 返回{listLabel}
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>
            {effectiveIsEdit ? '编辑' : newLabel}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {effectiveIsEdit && (
            <button
              onClick={() => setDrawerOpen(true)}
              type="button"
              style={{
                padding: '6px 12px',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              📜 历史 ({revisions.length})
            </button>
          )}
          {effectiveIsEdit && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
              {updatedAt && <div>更新时间 {updatedAt}</div>}
              {publishedAt && <div>发布时间 {publishedAt}</div>}
              {effectiveIsEdit && autoSaving && (
                <div style={{ color: '#F59E0B' }}>保存中…</div>
              )}
              {effectiveIsEdit && !autoSaving && autoSavedAt && (
                <div style={{ color: '#10B981' }}>已自动保存于 {autoSavedAt}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {error && <ErrorState title="Cannot save" description={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Main column */}
        <div>
          {/* Title */}
          <input
            type="text"
            placeholder="标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ ...inputStyle, fontSize: 'var(--font-size-xl)', padding: 'var(--space-md)', marginBottom: 16 }}
          />

          {/* Tabs + Toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 0,
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div style={{ display: 'flex', gap: 0 }}>
              <button
                onClick={() => setTab('write')}
                style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  background: tab === 'write' ? 'var(--color-surface-elevated)' : 'transparent',
                  color: tab === 'write' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  border: 'none',
                  borderBottom: tab === 'write' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                ✏️ 编辑
              </button>
              <button
                onClick={() => setTab('preview')}
                style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  background: tab === 'preview' ? 'var(--color-surface-elevated)' : 'transparent',
                  color: tab === 'preview' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  border: 'none',
                  borderBottom: tab === 'preview' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                👁 预览
              </button>
            </div>
            {/* Toolbar — image upload + paste/drop hint */}
            {tab === 'write' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingRight: 12 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) await handleImageFile(file);
                    // reset so the same file can be picked again
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  title="上传图片（也可拖拽到下方文本框，或 Ctrl+V 粘贴）"
                  style={{
                    padding: '4px 12px',
                    background: uploadingImage ? 'var(--color-surface)' : 'var(--color-surface-elevated)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    cursor: uploadingImage ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {uploadingImage ? '上传中…' : '🖼 上传图片'}
                </button>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  或拖拽 / Ctrl+V
                </span>
              </div>
            )}
          </div>

          {/* Content editor / preview */}
          {tab === 'write' ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{
                position: 'relative',
                border: isDraggingImage ? '2px dashed var(--color-primary)' : '2px dashed transparent',
                borderRadius: 'var(--radius-sm)',
                transition: 'border-color 0.15s',
              }}
            >
              {isDraggingImage && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(11, 12, 16, 0.85)', borderRadius: 'var(--radius-sm)', pointerEvents: 'none',
                  color: 'var(--color-primary)', fontSize: 'var(--font-size-md)', fontWeight: 500,
                }}>
                  拖放图片以上传
                </div>
              )}
              {uploadingImage && (
                <div style={{
                  position: 'absolute', top: 8, right: 8, zIndex: 10,
                  padding: '4px 10px', background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                  fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)',
                }}>
                  上传中…
                </div>
              )}
              <textarea
                ref={contentRef}
                placeholder="在此处用 Markdown 编写内容…（可拖拽图片或 Ctrl+V 粘贴图片）"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={handlePaste}
                style={{
                  ...inputStyle,
                  minHeight: 500,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--font-size-sm)',
                  lineHeight: 1.6,
                  padding: 'var(--space-md)',
                  borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                  borderBottom: tab === 'write' ? '1px solid var(--color-primary)' : undefined,
                }}
              />
            </div>
          ) : (
            <Card padding="md" style={{ minHeight: 500, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
              {content.trim() ? <Markdown>{content}</Markdown> : <p style={{ color: 'var(--color-text-muted)' }}>暂无内容可预览。</p>}
            </Card>
          )}

          {/* Description */}
          <div style={{ marginTop: 24 }}>
            <label style={labelStyle}>描述（用于 SEO / 摘要）</label>
            <textarea
              placeholder="简短描述"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ ...inputStyle, minHeight: 80 }}
            />
          </div>
        </div>

        {/* Settings sidebar */}
        <div>
          <Card padding="md">
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                style={inputStyle}
              >
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
                <option value="archived">归档</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>语言</label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                style={inputStyle}
              >
                <option value="ja">日本語</option>
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>封面图</label>
                <button
                  type="button"
                  onClick={() => setCoverPickerOpen(true)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-primary)',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  从媒体库选择…
                </button>
              </div>
              <input
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="https://… 或点击上方「从媒体库选择」"
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}
              />
              {coverImage && (
                <div style={{ marginTop: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverImage}
                    alt="封面预览"
                    style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                  />
                  {coverImage && (
                    <button
                      type="button"
                      onClick={() => setCoverImage('')}
                      style={{
                        marginTop: 4,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text-muted)',
                        fontSize: 11,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      清除封面图
                    </button>
                  )}
                </div>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>标签</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="逗号分隔，例如：AI, Cloudflare, 随笔"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>精选</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  style={{ width: 16, height: 16 }}
                />
                <span>在首页精选区域显示</span>
              </label>
            </div>
          </Card>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button variant="secondary" onClick={() => save('draft')} disabled={saving}>
              {saving ? '保存中…' : '保存草稿'}
            </Button>
            <Button variant="primary" onClick={() => save('published')} disabled={saving}>
              {saving ? '发布中…' : status === 'published' ? '更新发布' : `发布${typeLabel}`}
            </Button>
            {effectiveIsEdit && (
              <Button
                variant="ghost"
                onClick={handleDelete}
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                删除
              </Button>
            )}
          </div>

          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            集合：{isNotes ? '随笔 (notes)' : '博客 (posts)'}<br />
            {postId !== null && <>ID：{postId}</>}
          </div>
        </div>
      </div>

      {effectiveIsEdit && (
        <RevisionDrawer
          open={drawerOpen}
          revisions={revisions}
          loading={revisionsLoading}
          restoringId={restoringId}
          onRestore={handleRestoreRevision}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {effectiveIsEdit && (
        <ConflictModal
          open={conflictOpen}
          message={conflictMessage}
          onReload={() => { setConflictOpen(false); refetchPost(); }}
          onKeepEditing={() => setConflictOpen(false)}
        />
      )}

      <CoverImagePicker
        open={coverPickerOpen}
        onClose={() => setCoverPickerOpen(false)}
        onSelect={(url) => setCoverImage(url)}
        currentValue={coverImage}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────
// Revision Drawer — Phase A §26
// Side panel listing all revisions of the current post, with Restore buttons.
// ────────────────────────────────────────────────────

interface RevisionDrawerProps {
  open: boolean;
  revisions: any[];
  loading: boolean;
  restoringId: number | null;
  onRestore: (id: number) => void;
  onClose: () => void;
}

function RevisionDrawer({ open, revisions, loading, restoringId, onRestore, onClose }: RevisionDrawerProps) {
  if (!open) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)', zIndex: 99,
        }}
      />
      {/* Drawer */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
          background: '#0A0A0F', borderLeft: '1px solid #1E1E2E',
          padding: 24, overflowY: 'auto', zIndex: 100,
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, color: '#F5F7FA', margin: 0 }}>修订历史</h2>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#A6ADBB', fontSize: 20, cursor: 'pointer' }}
            type="button"
          >
            ×
          </button>
        </div>
        {loading && <p style={{ color: '#707887', fontSize: 13 }}>加载修订中…</p>}
        {!loading && revisions.length === 0 && (
          <p style={{ color: '#707887', fontSize: 13 }}>暂无修订记录。保存文章即可创建。</p>
        )}
        {!loading && revisions.map((rev) => (
          <div
            key={rev.id}
            style={{
              padding: 12,
              marginBottom: 8,
              background: '#14141C',
              border: '1px solid #1E1E2E',
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 11, color: '#707887', fontFamily: 'monospace', marginBottom: 4 }}>
              {rev.changed_at}
              {rev.locale && ` · ${rev.locale}`}
              {rev.status && ` · ${rev.status}`}
            </div>
            <div style={{ fontSize: 13, color: '#F5F7FA', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {rev.title || '（无标题）'}
            </div>
            <button
              onClick={() => onRestore(rev.id)}
              disabled={restoringId === rev.id}
              type="button"
              style={{
                padding: '4px 10px',
                background: restoringId === rev.id ? '#272B36' : 'transparent',
                color: restoringId === rev.id ? '#707887' : '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 4,
                fontSize: 11,
                cursor: restoringId === rev.id ? 'default' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {restoringId === rev.id ? '恢复中…' : '恢复此版本'}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────
// Conflict Modal — Phase C1 §27 Optimistic Lock
// Shown when PUT returns 409 (post.updated_at on server no longer matches
// the loaded_updated_at client sent). User must choose: reload server version
// (discard local edits) or keep editing (overwrite with current form state).
// ────────────────────────────────────────────────────

interface ConflictModalProps {
  open: boolean;
  message: string;
  onReload: () => void;
  onKeepEditing: () => void;
}

function ConflictModal({ open, message, onReload, onKeepEditing }: ConflictModalProps) {
  if (!open) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onKeepEditing}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)', zIndex: 110,
        }}
      />
      {/* Centered modal */}
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 440, maxWidth: '92vw',
          background: '#0A0A0F', border: '1px solid #F59E0B',
          borderRadius: 12, padding: 24, zIndex: 120,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h2 style={{ fontSize: 16, color: '#F59E0B', margin: '0 0 12px 0', fontWeight: 600 }}>
          ⚠ 冲突 — 文章在其他地方被修改
        </h2>
        <p style={{ fontSize: 13, color: '#A6ADBB', lineHeight: 1.6, margin: '0 0 20px 0' }}>
          {message}
        </p>
        <p style={{ fontSize: 12, color: '#707887', margin: '0 0 24px 0', fontFamily: 'monospace' }}>
          重新加载会丢弃你本地未保存的修改。
          继续编辑会用当前表单的内容覆盖服务器版本。
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onKeepEditing}
            type="button"
            style={{
              padding: '8px 16px', background: 'transparent', color: '#A6ADBB',
              border: '1px solid #272B36', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            继续编辑
          </button>
          <button
            onClick={onReload}
            type="button"
            style={{
              padding: '8px 16px', background: '#F59E0B', color: '#0A0A0F',
              border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600,
            }}
          >
            加载最新版本
          </button>
        </div>
      </div>
    </>
  );
}
