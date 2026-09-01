// src/app/admin/posts/[id]/page.tsx
// Edit existing post — load, edit form, save (PUT), publish (POST), delete (DELETE)
'use client';

import { use, useEffect, useState, type FormEvent, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPut } from '@/lib/cms/api-client';
import type { Locale, PostCollection, Post } from '@/lib/cms/types';
import { postFormStyles as s } from '../new/post-form-styles';

interface PageProps {
  params: Promise<{ id: string }>;
}

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

export default function EditPostPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);
  const postId = parseInt(id, 10);

  const [post, setPost] = useState<Post | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchPost();
  }, [postId]);

  async function fetchPost() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Post>(`/api/admin/posts/${postId}`);
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
      // Save first, then publish
      const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
      await apiPut(`/api/admin/posts/${postId}`, {
        ...form,
        cover_image: form.cover_image || null,
        tags,
      });
      await fetch(`/api/admin/posts/${postId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      setSavedAt(`Published at ${new Date().toLocaleTimeString()}`);
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

        {error && <p style={s.error}>{error}</p>}
        {savedAt && <p style={{ ...s.error, background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}>{savedAt}</p>}

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
      </div>
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
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}
