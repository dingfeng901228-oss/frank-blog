'use client';

// src/app/admin/categories/page.tsx — Phase 5 (Categories management)
// Per docs/CMS V2.md §二十三 (Categories — collection-aware)

import { useEffect, useState, type CSSProperties } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { apiDelete, apiGet, apiPost, errorMessage } from '@/lib/cms/api-client';

interface Category {
  id: number;
  name: string;
  slug: string;
  collection: 'posts' | 'notes';
  created_at: string;
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

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCollection, setFormCollection] = useState<'posts' | 'notes'>('posts');
  const toast = useToast();

  async function fetchCategories() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ items: Category[] }>('/api/admin/categories');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: unknown) {
      // Item 1 — the raw JS error ("Cannot read properties of undefined")
      // is logged by the api-client; the page shows a readable message.
      setError(errorMessage(e, '分类加载失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) {
      toast.show('请填写名称和 slug', 'error');
      return;
    }
    try {
      await apiPost('/api/admin/categories', {
        name: formName.trim(),
        slug: formSlug.trim(),
        collection: formCollection,
      });
      toast.show('分类已创建', 'success');
      setShowForm(false);
      setFormName('');
      setFormSlug('');
      fetchCategories();
    } catch (e: unknown) {
      toast.show(errorMessage(e, '创建失败'), 'error');
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`确认删除分类「${name}」？此操作不可撤销。`)) return;
    try {
      await apiDelete(`/api/admin/categories/${id}`);
      toast.show('分类已删除', 'success');
      fetchCategories();
    } catch (e: unknown) {
      toast.show(errorMessage(e, '删除失败'), 'error');
    }
  }

  const blogCategories = items.filter((c) => c.collection === 'posts');
  const noteCategories = items.filter((c) => c.collection === 'notes');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-text-primary)' }}>分类</h1>
        <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? '取消' : '+ 新建分类'}
        </Button>
      </div>

      {showForm && (
        <Card padding="md" style={{ marginBottom: 24 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'block' }}>名称</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (!formSlug) setFormSlug(e.target.value.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'));
                }}
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'block' }}>Slug</label>
              <input
                type="text"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                style={{ ...inputStyle, width: '100%', fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div style={{ minWidth: 120 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'block' }}>集合</label>
              <select
                value={formCollection}
                onChange={(e) => setFormCollection(e.target.value as 'posts' | 'notes')}
                style={{ ...inputStyle, width: '100%' }}
              >
                <option value="posts">博客</option>
                <option value="notes">随笔</option>
              </select>
            </div>
            <Button variant="primary" type="submit">创建</Button>
          </form>
        </Card>
      )}

      {/*
        Item 1 — the error state and the empty state used to be shown at
        the same time: the page printed "加载分类失败 / Cannot read
        properties of undefined" AND "暂无分类". Now an error means
        "we do not know what is there", so only the error (with a retry
        button) is shown — never a false empty state.
      */}
      {error ? (
        <ErrorState
          title="加载分类失败"
          description={error}
          action={
            <Button variant="primary" onClick={fetchCategories}>
              重试
            </Button>
          }
        />
      ) : loading ? (
        <CategorySkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title="暂无分类"
          description="创建第一个分类来组织文章。"
          action={
            <Button variant="primary" onClick={() => setShowForm(true)}>+ 新建分类</Button>
          }
        />
      ) : (
        <>
          <h2 style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12 }}>
            博客 ({blogCategories.length})
          </h2>
          {blogCategories.length === 0 ? (
            <Card padding="md" style={{ marginBottom: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              暂无博客分类
            </Card>
          ) : (
            <CategoryList items={blogCategories} onDelete={handleDelete} />
          )}
          <h2 style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12, marginTop: 32 }}>
            随笔 ({noteCategories.length})
          </h2>
          {noteCategories.length === 0 ? (
            <Card padding="md" style={{ marginBottom: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              暂无随笔分类
            </Card>
          ) : (
            <CategoryList items={noteCategories} onDelete={handleDelete} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Item 17 — a skeleton in the shape of the category table instead of
 * the full-page "加载分类中…".
 */
function CategorySkeleton() {
  return (
    <Card padding="md">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 18, width: `${70 - i * 8}%`, marginBottom: 14 }}
        />
      ))}
    </Card>
  );
}

function CategoryList({
  items,
  onDelete,
}: {
  items: Category[];
  onDelete: (id: number, name: string) => void;
}) {
  return (
    <Card padding="none">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>名称</th>
            <th style={thStyle}>Slug</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id}>
              <td style={tdStyle}>
                <div style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{c.name}</div>
              </td>
              <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-muted)' }}>
                /{c.slug}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                <button
                  onClick={() => onDelete(c.id, c.name)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-danger)',
                    fontSize: 12,
                    fontFamily: 'inherit',
                  }}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

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
};

const tdStyle: CSSProperties = {
  padding: 'var(--space-md)',
  fontSize: 'var(--font-size-sm)',
  borderBottom: '1px solid var(--color-border)',
};
