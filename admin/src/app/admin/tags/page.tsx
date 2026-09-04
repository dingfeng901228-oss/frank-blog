'use client';

// src/app/admin/tags/page.tsx — Phase 5 (Tags management)
// Per docs/CMS V2.md §二十四 (Tags)

import { useEffect, useState, type CSSProperties } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';

interface Tag {
  id: number;
  name: string;
  slug: string;
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

export default function TagsPage() {
  const [items, setItems] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormSlug] = useState('');
  const toast = useToast();

  async function fetchTags() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tags', { credentials: 'include' });
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
    fetchTags();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim()) {
      toast.show('Name required', 'error');
      return;
    }
    const slug = formName.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    try {
      const res = await fetch('/api/admin/tags', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), slug }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Create failed');
      }
      toast.show('Tag created', 'success');
      setShowForm(false);
      setFormSlug('');
      fetchTags();
    } catch (e: any) {
      toast.show(e.message || 'Create failed', 'error');
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete tag "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/tags/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Delete failed');
      }
      toast.show('Tag deleted', 'success');
      fetchTags();
    } catch (e: any) {
      toast.show(e.message || 'Delete failed', 'error');
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>Tags</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            {items.length} total
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : '+ New Tag'}
        </Button>
      </div>

      {showForm && (
        <Card padding="md" style={{ marginBottom: 24 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, display: 'block' }}>Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormSlug(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
                placeholder="e.g. Japanese, Cloudflare, AI"
              />
            </div>
            <Button variant="primary" type="submit">Create</Button>
          </form>
        </Card>
      )}

      {error && <ErrorState title="Failed to load tags" description={error} />}

      {loading ? (
        <LoadingState message="Loading tags..." />
      ) : items.length === 0 ? (
        <EmptyState
          title="No tags yet"
          description="Create tags to label your articles."
          action={<Button variant="primary" onClick={() => setShowForm(true)}>+ New Tag</Button>}
        />
      ) : (
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
              {items.map((t) => (
                <tr key={t.id}>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: 12, background: 'var(--color-surface-elevated)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)' }}>
                      #{t.name}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-muted)' }}>
                    /{t.slug}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
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
      )}
    </div>
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
