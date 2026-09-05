// admin/src/app/admin/posts/edit/page.tsx
// Edit existing post — uses ?id= query param instead of [id] dynamic route
// (Output: 'export' can't pre-generate dynamic routes with unknown IDs from D1)
// Phase 6: Preview tab reusing src/components/Markdown.tsx (per ADR-005 same renderer)

'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent, type CSSProperties, type ClipboardEvent, type DragEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Markdown from '@/components/Markdown';
import { apiGet, apiPatch, apiPut } from '@/lib/cms/api-client';
import { extractImageFile, uploadImageFile, buildImageMarkdown, insertAtCursor } from '@/lib/image-upload';
import type { Locale, PostCollection } from '@/lib/cms/types';
import { postFormStyles as s } from '../new/post-form-styles';

interface FormState {
  collection: PostCollection;
  locale: Locale;
  slug: string;
  title: string;
  description_text: string;
  content: string;
  cover_image: string;
  tags: string;
  is_featured: boolean;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  updated_at: string;
}

type Mode = 'edit' | 'preview';

function EditPostInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  const postId = idParam ? parseInt(idParam, 10) : NaN;

  const [post, setPost] = useState<any | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('edit');

  // ── Phase A §19 — Auto-save state ──
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoSavedSnapshot = useRef<string>('');

  // ── Phase A §26 — Revision drawer state ──
  const [revisions, setRevisions] = useState<any[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  // ── Phase B §13 ②③ — paste + drag/drop image upload ──
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);

  async function handleImageFile(file: File) {
    const currentForm = form;
    if (!currentForm) return;
    setUploadingImage(true);
    try {
      const image = await uploadImageFile(file, '');
      const md = buildImageMarkdown(image) + '\n';
      if (contentRef.current) {
        insertAtCursor(contentRef.current, md);
        setForm({ ...currentForm, content: contentRef.current.value });
      } else {
        setForm({ ...currentForm, content: currentForm.content + md });
      }
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleContentPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const file = extractImageFile(e.clipboardData);
    if (file) {
      e.preventDefault();
      await handleImageFile(file);
    }
  }

  function handleContentDragOver(e: DragEvent) {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setIsDraggingImage(true);
    }
  }

  function handleContentDragLeave() {
    setIsDraggingImage(false);
  }

  async function handleContentDrop(e: DragEvent) {
    const file = extractImageFile(e.dataTransfer);
    if (file) {
      e.preventDefault();
      setIsDraggingImage(false);
      await handleImageFile(file);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(postId)) return;
    fetchPost();
    fetchRevisions();
  }, [postId]);

  // ── Phase A §19 — Auto-save debounce (saves content/title/slug/description_text every 2s) ──
  useEffect(() => {
    if (!form) return;
    const snapshot = JSON.stringify({
      title: form.title,
      slug: form.slug,
      content: form.content,
      description_text: form.description_text,
    });
    if (snapshot === lastAutoSavedSnapshot.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        setAutoSaving(true);
        await apiPatch(`/api/admin/posts/${postId}`, {
          title: form.title,
          slug: form.slug,
          content: form.content,
          description_text: form.description_text,
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
  }, [form?.title, form?.slug, form?.content, form?.description_text]);

  async function fetchRevisions() {
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

  async function fetchPost() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<any>(`/api/admin/posts/${postId}`);
      setPost(data);
      setForm({
        collection: data.collection,
        locale: data.locale,
        slug: data.slug,
        title: data.title,
        description_text: data.description_text,
        content: data.content,
        cover_image: data.cover_image ?? '',
        tags: data.tags ? safeParseTags(data.tags).join(', ') : '',
        is_featured: data.is_featured === 1,
        status: data.status,
        published_at: data.published_at,
        updated_at: data.updated_at,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      await apiPut(`/api/admin/posts/${postId}`, {
        collection: form.collection,
        locale: form.locale,
        slug: form.slug,
        title: form.title,
        description_text: form.description_text,
        content: form.content,
        cover_image: form.cover_image || null,
        tags,
        is_featured: form.is_featured,
        status: form.status,
      });
      setSavedAt(new Date().toLocaleTimeString());
      fetchPost();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!form) return;
    setPublishing(true);
    setError(null);
    try {
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      await apiPut(`/api/admin/posts/${postId}`, {
        ...form,
        cover_image: form.cover_image || null,
        tags,
      });
      const res = await fetch(`/api/admin/posts/${postId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        setSavedAt(`Published at ${new Date().toLocaleTimeString()}`);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(`Publish failed: ${data.error?.message || res.statusText}`);
      }
      fetchPost();
    } catch (e: any) {
      setError(`Publish failed: ${e.message}`);
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    if (!post) return;
    if (!confirm(`Delete post "${post.title}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/admin/posts/${postId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      router.push('/admin/posts');
    } catch (e: any) {
      setError(e.message);
    }
  }

  // ── Phase A §26 — Restore revision handler ──
  async function handleRestoreRevision(revisionId: number) {
    if (!confirm('Restore this revision? Current content will be overwritten with the revision snapshot.')) return;
    setRestoringId(revisionId);
    try {
      const res = await fetch(`/api/admin/posts/${postId}/revisions/${revisionId}/restore`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Restore failed');
      }
      await fetchPost();
      await fetchRevisions();
      setDrawerOpen(false);
    } catch (e: any) {
      setError(`Restore failed: ${e.message}`);
    } finally {
      setRestoringId(null);
    }
  }

  if (!Number.isFinite(postId)) {
    return (
      <div style={s.page}>
        <p style={s.error}>Missing or invalid post id. Use ?id=123 in the URL.</p>
        <Link href="/admin/posts" style={s.backLink}>← Posts</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={s.page}>
        <p style={{ color: '#707080' }}>Loading…</p>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div style={s.page}>
        <Link href="/admin/posts" style={s.backLink}>← Posts</Link>
        <p style={{ ...s.error, marginTop: 16 }}>{error}</p>
      </div>
    );
  }

  if (!form) return null;

  return (
    <div style={s.page}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Link href="/admin/posts" style={s.backLink}>← Posts</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
          <h1 style={s.h1}>Edit Post #{postId}</h1>
          <button
            onClick={() => setDrawerOpen(true)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'transparent',
              color: '#A6ADBB',
              border: '1px solid #272B36',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: 'pointer',
              marginLeft: 12,
            }}
            type="button"
          >
            📜 History ({revisions.length})
          </button>
          <div style={{ fontSize: 11, color: '#707080', textAlign: 'right' }}>
            <div>Updated {form.updated_at}</div>
            {form.published_at && <div>Published {form.published_at}</div>}
            {autoSaving && <div style={{ color: '#F59E0B' }}>Saving…</div>}
            {!autoSaving && autoSavedAt && <div style={{ color: '#10B981' }}>Saved at {autoSavedAt}</div>}
          </div>
        </div>

        {/* Tabs */}
        <div style={tabBarStyle}>
          <button onClick={() => setMode('edit')} style={mode === 'edit' ? tabActiveStyle : tabStyle}>
            ✏️ Edit
          </button>
          <button onClick={() => setMode('preview')} style={mode === 'preview' ? tabActiveStyle : tabStyle}>
            👁 Preview
          </button>
        </div>

        {error && <p style={s.error}>{error}</p>}
        {savedAt && (
          <p style={{ ...s.error, background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}>
            {savedAt}
          </p>
        )}

        {mode === 'preview' ? (
          <PreviewPanel form={form} />
        ) : (
          <form onSubmit={handleSave} style={s.form}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={s.label}>Collection</label>
                <select value={form.collection} onChange={(e) => setForm({ ...form, collection: e.target.value as PostCollection })} style={s.input}>
                  <option value="posts">Posts</option>
                  <option value="notes">Notes</option>
                </select>
              </div>
              <div>
                <label style={s.label}>Locale</label>
                <select value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value as Locale })} style={s.input}>
                  <option value="ja">日本語</option>
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label style={s.label}>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })} style={s.input}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <Field label="Title">
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                style={{ ...s.input, fontSize: 18, fontFamily: 'Georgia, serif' }}
              />
            </Field>

            <Field label="Slug">
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                required
                style={{ ...s.input, fontFamily: 'monospace' }}
              />
            </Field>

            <Field label="Description" hint="multi-line OK (preserves as YAML block scalar)">
              <textarea
                value={form.description_text}
                onChange={(e) => setForm({ ...form, description_text: e.target.value })}
                rows={3}
                style={{ ...s.input, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </Field>

            <Field label="Cover Image URL">
              <input
                type="text"
                value={form.cover_image}
                onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
                style={{ ...s.input, fontFamily: 'monospace' }}
              />
            </Field>

            <Field label="Tags" hint="comma-separated">
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                style={s.input}
              />
            </Field>

            <Field label="Featured">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                  style={{ width: 16, height: 16 }}
                />
                <span style={{ fontSize: 13 }}>Show on homepage featured section</span>
              </label>
            </Field>

            <Field label="Content (MDX)" hint="Ctrl+V paste image, or drag image in">
              <div
                onDragOver={handleContentDragOver}
                onDragLeave={handleContentDragLeave}
                onDrop={handleContentDrop}
                style={{
                  position: 'relative',
                  border: isDraggingImage ? '2px dashed #10b981' : '2px dashed transparent',
                  borderRadius: 8,
                  transition: 'border-color 0.15s',
                }}
              >
                {isDraggingImage && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.8)', borderRadius: 8, pointerEvents: 'none',
                    color: '#10b981', fontSize: 14, fontWeight: 500,
                  }}>
                    Drop image to upload
                  </div>
                )}
                {uploadingImage && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 10,
                    padding: '4px 10px', background: '#14141C',
                    border: '1px solid #1E1E2E', borderRadius: 6,
                    fontSize: 11, color: '#707887',
                  }}>
                    Uploading…
                  </div>
                )}
                <textarea
                  ref={contentRef}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  onPaste={handleContentPaste}
                  rows={20}
                  required
                  style={{
                    ...s.input,
                    fontFamily: "'Fira Code', monospace",
                    fontSize: 13,
                    lineHeight: 1.6,
                    resize: 'vertical',
                  }}
                />
              </div>
            </Field>

            <div style={{ display: 'flex', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
              <button type="submit" disabled={saving} style={{ ...s.primaryButton, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                style={{ ...s.primaryButton, backgroundColor: '#10b981', opacity: publishing ? 0.7 : 1 }}
              >
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                style={{ ...s.secondaryButton, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                Delete
              </button>
              <Link href="/admin/posts" style={s.secondaryButton}>Cancel</Link>
            </div>
          </form>
        )}

        <RevisionDrawer
          open={drawerOpen}
          revisions={revisions}
          loading={revisionsLoading}
          restoringId={restoringId}
          onRestore={handleRestoreRevision}
          onClose={() => setDrawerOpen(false)}
        />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// Preview Panel — renders same Markdown component as production frontend
// Per ADR-005: same renderer for preview + production
// ────────────────────────────────────────────────────

function PreviewPanel({ form }: { form: FormState }) {
  return (
    <div style={{ backgroundColor: '#14141C', border: '1px solid #1E1E2E', padding: 32, borderRadius: 12 }}>
      {/* Preview header */}
      <div style={{ borderBottom: '1px solid #1E1E2E', paddingBottom: 16, marginBottom: 24 }}>
        <h2 style={{ fontSize: 11, color: '#707080', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 8 }}>
          Preview · live unsaved changes
        </h2>
        <h1 style={{ fontSize: 32, fontFamily: 'Georgia, serif', fontWeight: 500, lineHeight: 1.2, marginBottom: 12 }}>
          {form.title || <span style={{ color: '#707080' }}>(Untitled)</span>}
        </h1>
        {form.description_text && (
          <p style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.5 }}>
            {form.description_text}
          </p>
        )}
        <p style={{ fontSize: 11, color: '#707080', marginTop: 12, fontFamily: 'monospace' }}>
          /{form.collection}/{form.locale}/{form.slug || '(no-slug)'} · {form.status}
        </p>
      </div>

      {/* Markdown content — same renderer as src/components/Markdown.tsx */}
      <article style={{ lineHeight: 1.7 }}>
        {form.content ? (
          <Markdown>{form.content}</Markdown>
        ) : (
          <p style={{ color: '#707080', fontStyle: 'italic' }}>(No content yet)</p>
        )}
      </article>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={s.label}>{label}{hint && <span style={s.labelHint}> · {hint}</span>}</label>
      {children}
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
          <h2 style={{ fontSize: 16, color: '#F5F7FA', margin: 0 }}>Revision History</h2>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#A6ADBB', fontSize: 20, cursor: 'pointer' }}
            type="button"
          >
            ×
          </button>
        </div>
        {loading && <p style={{ color: '#707887', fontSize: 13 }}>Loading revisions…</p>}
        {!loading && revisions.length === 0 && (
          <p style={{ color: '#707887', fontSize: 13 }}>No revisions yet. Save the post to create one.</p>
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
              {rev.title || '(untitled)'}
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
              {restoringId === rev.id ? 'Restoring…' : 'Restore'}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function safeParseTags(json: string): string[] {
 {
    try {
      const arr = JSON.parse(json);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  }
}

const tabBarStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  marginBottom: 16,
  backgroundColor: '#14141C',
  padding: 4,
  borderRadius: 8,
  border: '1px solid #1E1E2E',
  width: 'fit-content',
};

const tabStyle: CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'transparent',
  color: '#707080',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

const tabActiveStyle: CSSProperties = {
  ...tabStyle,
  backgroundColor: '#0A0A0F',
  color: '#E8E8EC',
};

// Wrap in Suspense for useSearchParams (Next.js 15 requirement)
export default function EditPostPage() {
  return (
    <Suspense fallback={<div style={s.page}><p style={{ color: '#707080' }}>Loading…</p></div>}>
      <EditPostInner />
    </Suspense>
  );
}