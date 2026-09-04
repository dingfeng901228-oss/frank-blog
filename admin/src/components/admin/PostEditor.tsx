'use client';

// src/components/admin/PostEditor.tsx — Phase 3
// Shared editor for Blog + Notes new + edit pages.
// Used by /admin/blog/new, /admin/notes/new, /admin/blog/[id]/edit, /admin/notes/[id]/edit
// Per docs/CMS V2.md §十 (Editor UX) + §二十二 (Collection auto-determined by route) + §二十 (Preview uses Markdown.tsx)

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import Markdown from '@/components/Markdown';
import { useToast } from '@/components/ui/Toast';

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
    locale: Locale;
    status: Status;
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

export function PostEditor({ collection, initialPost }: PostEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = !!initialPost;

  const [title, setTitle] = useState(initialPost?.title || '');
  const [slug, setSlug] = useState(initialPost?.slug || '');
  const [description, setDescription] = useState(initialPost?.description_text || '');
  const [content, setContent] = useState(initialPost?.content || '');
  const [locale, setLocale] = useState<Locale>(initialPost?.locale || 'ja');
  const [status, setStatus] = useState<Status>(initialPost?.status || 'draft');
  const [tab, setTab] = useState<Tab>('write');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(isEdit);

  // Auto-generate slug from title (only if user hasn't manually edited it)
  useEffect(() => {
    if (!slugTouched && title) {
      setSlug(slugify(title));
    }
  }, [title, slugTouched]);

  async function save(targetStatus: Status) {
    if (!title.trim() || !slug.trim() || !content.trim()) {
      setError('Title, slug, and content are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = isEdit ? `/api/admin/posts/${initialPost!.id}` : '/api/admin/posts';
      const method = isEdit ? 'PUT' : 'POST';
      const body: Record<string, unknown> = {
        collection,
        slug,
        title,
        description_text: description,
        content,
        locale,
        status: targetStatus,
      };
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Save failed');
      }
      toast.show(
        targetStatus === 'published'
          ? (isEdit ? 'Published' : 'Article published')
          : 'Draft saved',
        'success'
      );
      if (!isEdit && data.data?.id) {
        router.push(`/admin/${collection === 'notes' ? 'notes' : 'blog'}/edit?id=${data.data.id}`);
      }
    } catch (e: any) {
      const msg = e?.message || 'Save failed';
      toast.show(msg, 'error');
      setError(msg);
    } finally {
      setSaving(false);
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
  const listLabel = isNotes ? 'Notes' : 'Blog';
  const typeLabel = isNotes ? 'Note' : 'Article';
  const newLabel = isNotes ? 'New Note' : 'New Article';

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Link href={listHref} style={{ fontSize: 12, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
          ← Back to {listLabel}
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {isEdit ? 'Edit' : newLabel}
        </h1>
      </div>

      {error && <ErrorState title="Cannot save" description={error} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {/* Main column */}
        <div>
          {/* Title */}
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ ...inputStyle, fontSize: 'var(--font-size-xl)', padding: 'var(--space-md)', marginBottom: 16 }}
          />

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 0, borderBottom: '1px solid var(--color-border)' }}>
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
              Write
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
              Preview
            </button>
          </div>

          {/* Content editor / preview */}
          {tab === 'write' ? (
            <textarea
              placeholder="Write your content in Markdown..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
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
          ) : (
            <Card padding="md" style={{ minHeight: 500, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
              {content.trim() ? <Markdown>{content}</Markdown> : <p style={{ color: 'var(--color-text-muted)' }}>Nothing to preview yet.</p>}
            </Card>
          )}

          {/* Description */}
          <div style={{ marginTop: 24 }}>
            <label style={labelStyle}>Description (used for SEO / feed)</label>
            <textarea
              placeholder="Short description"
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
              <label style={labelStyle}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                style={inputStyle}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Locale</label>
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
            <div>
              <label style={labelStyle}>Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}
              />
            </div>
          </Card>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button variant="secondary" onClick={() => save('draft')} disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </Button>
            <Button variant="primary" onClick={() => save('published')} disabled={saving}>
              {saving ? 'Publishing…' : status === 'published' ? 'Update' : `Publish ${typeLabel}`}
            </Button>
          </div>

          <div style={{ marginTop: 16, fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            Collection: {isNotes ? 'notes' : 'posts (Blog)'}<br />
            {isEdit && initialPost && <>ID: {initialPost.id}</>}
          </div>
        </div>
      </div>
    </div>
  );
}
