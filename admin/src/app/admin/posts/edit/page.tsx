// admin/src/app/admin/posts/edit/page.tsx
// Edit existing post — uses ?id= query param instead of [id] dynamic route
// (Output: 'export' can't pre-generate dynamic routes with unknown IDs from D1)
// Phase 6: Preview tab reusing src/components/Markdown.tsx (per ADR-005 same renderer)

'use client';

import { Suspense, useEffect, useState, type FormEvent, type CSSProperties } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Markdown from '@/components/Markdown';
import { apiGet, apiPut } from '@/lib/cms/api-client';
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

  useEffect(() => {
    if (!Number.isFinite(postId)) return;
    fetchPost();
  }, [postId]);

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
          <div style={{ fontSize: 11, color: '#707080', textAlign: 'right' }}>
            <div>Updated {form.updated_at}</div>
            {form.published_at && <div>Published {form.published_at}</div>}
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

            <Field label="Content (MDX)">
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
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