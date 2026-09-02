// src/app/admin/posts/new/page.tsx
// New post form — redirects to /admin/posts/[id] after successful create
'use client';

import { useState, type FormEvent, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiPost } from '@/lib/cms/api-client';
import type { Locale, PostCollection } from '@/lib/cms/types';
import { postFormStyles as s } from './post-form-styles';

interface FormState {
  collection: PostCollection;
  locale: Locale;
  slug: string;
  title: string;
  description_text: string;
  content: string;
  cover_image: string;
  tags: string; // comma-separated for input
  is_featured: boolean;
  status: 'draft' | 'published' | 'archived';
}

export default function NewPostPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    collection: 'posts',
    locale: 'ja',
    slug: '',
    title: '',
    description_text: '',
    content: '',
    cover_image: '',
    tags: '',
    is_featured: false,
    status: 'draft',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function autoSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const data = await apiPost<{ id: number }>('/api/admin/posts', {
        collection: form.collection,
        locale: form.locale,
        slug: form.slug || autoSlug(form.title),
        title: form.title,
        description_text: form.description_text,
        content: form.content,
        cover_image: form.cover_image || null,
        tags,
        is_featured: form.is_featured,
        status: form.status,
        content_format: 'mdx',
        published_at: new Date().toISOString().split('T')[0],
      });

      router.push(`/admin/posts/${data.id}`);
    } catch (e: any) {
      setError(e.message || 'Failed to create post');
      setSaving(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <Link href="/admin/posts" style={s.backLink}>← Posts</Link>
        <h1 style={s.h1}>New Post</h1>

        {error && <p style={s.error}>{error}</p>}

        <form onSubmit={handleSubmit} style={s.form}>
          <Row>
            <Field label="Collection">
              <select value={form.collection} onChange={(e) => setForm({ ...form, collection: e.target.value as PostCollection })} style={s.input}>
                <option value="posts">Posts</option>
                <option value="notes">Notes</option>
              </select>
            </Field>
            <Field label="Locale">
              <select value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value as Locale })} style={s.input}>
                <option value="ja">日本語</option>
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })} style={s.input}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </Row>

          <Field label="Title">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onBlur={() => { if (!form.slug && form.title) setForm({ ...form, slug: autoSlug(form.title) }); }}
              required
              style={{ ...s.input, fontSize: 18, fontFamily: 'Georgia, serif' }}
              placeholder="Post title"
            />
          </Field>

          <Field label="Slug" hint="auto-generated from title if empty">
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
              style={{ ...s.input, fontFamily: 'monospace' }}
              placeholder="my-post-slug"
            />
          </Field>

          <Field label="Description" hint="multi-line OK (preserves as YAML block scalar)">
            <textarea
              value={form.description_text}
              onChange={(e) => setForm({ ...form, description_text: e.target.value })}
              rows={3}
              style={{ ...s.input, fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="Brief description for SEO meta..."
            />
          </Field>

          <Field label="Cover Image URL" hint="absolute URL, e.g. https://blog.frank2025.com/images/...">
            <input
              type="text"
              value={form.cover_image}
              onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
              style={{ ...s.input, fontFamily: 'monospace' }}
              placeholder="https://..."
            />
          </Field>

          <Field label="Tags" hint="comma-separated">
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              style={{ ...s.input }}
              placeholder="JLPT, N2, 哲学"
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

          <Field label="Content (MDX)" hint="raw MDX/Markdown body — no frontmatter (auto-generated)">
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
              placeholder={"## Hello\n\nWrite your MDX/Markdown here.\n\nUse `code`, **bold**, *italic*."}
            />
          </Field>

          <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
            <button type="submit" disabled={saving} style={{ ...s.primaryButton, opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Creating…' : 'Create Post'}
            </button>
            <Link href="/admin/posts" style={s.secondaryButton}>Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>{children}</div>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={s.label}>{label}{hint && <span style={s.labelHint}> · {hint}</span>}</label>
      {children}
    </div>
  );
}
