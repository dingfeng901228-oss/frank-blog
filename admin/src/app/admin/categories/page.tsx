'use client';

// src/app/admin/categories/page.tsx — Phase 5 (Categories management)
// Per docs/CMS V2.md §二十三 (Categories — collection-aware)

import { useEffect, useState, type CSSProperties } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';

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
      const res = await fetch('/api/admin/categories', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to fetch');
      }
      setItems(data.data.items);
    } catch (e: any) {
      setError(e.message || 'Unknown error');
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
      toast.show('Name and slug required', 'error');
      return;
    }
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          slug: formSlug.trim(),
          collection: formCollection,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Create failed');
      }
      toast.show('Category created', 'success');
      setShowForm(false);
      setFormName('');
      setFormSlug('');
      fetchCategories();
    } catch (e: any) {
      toast.show(e.message || 'Create failed', 'error');
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete category "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Delete failed');
      }
      toast.show('Category deleted', 'success');
      fetchCategories();
    } catch (e: any) {
      toast.show(e.message || 'Delete failed', 'error');
    }
  }

  const blogCategories = items.filter((c) => c.collection === 'posts');
  const noteCategories = items.filter((c) => c.collection === 'notes');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-text-primary)' }}>Categories</h1>
        <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ New Category'}
        </Button>
      </div>

      {showForm && (
        <Card padding="md" style={{ marginBottom: 24 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'block' }}>Name</label>
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
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'block' }}>Collection</label>
              <select
                value={formCollection}
                onChange={(e) => setFormCollection(e.target.value as 'posts' | 'notes')}
                style={{ ...inputStyle, width: '100%' }}
              >
                <option value="posts">Blog</option>
                <option value="notes">Notes</option>
              </select>
            </div>
            <Button variant="primary" type="submit">Create</Button>
          </form>
        </Card>
      )}

      {error && <ErrorState title="Failed to load categories" description={error} />}

      {loading ? (
        <LoadingState message="Loading categories..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create your first category to organize posts."
          action={
            <Button variant="primary" onClick={() => setShowForm(true)}>+ New Category</Button>
          }
        />
      ) : (
        <>
          <h2 style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12 }}>
            Blog ({blogCategories.length})
          </h2>
          {blogCategories.length === 0 ? (
            <Card padding="md" style={{ marginBottom: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              No blog categories
            </Card>
          ) : (
            <CategoryList items={blogCategories} onDelete={handleDelete} />
          )}
          <h2 style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 12, marginTop: 32 }}>
            Notes ({noteCategories.length})
          </h2>
          {noteCategories.length === 0 ? (
            <Card padding="md" style={{ marginBottom: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              No note categories
            </Card>
          ) : (
            <CategoryList items={noteCategories} onDelete={handleDelete} />
          )}
        </>
      )}
    </div>
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
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Slug</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
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
                  Delete
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
