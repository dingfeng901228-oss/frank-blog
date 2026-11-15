'use client';

// src/app/admin/tags/page.tsx — Phase 5 (Tags management)
// Per docs/CMS V2.md §二十四 (Tags)
//
// Item 5 — the tag system. The tag page used to show "共 0 个标签"
// because nothing ever wrote to the `tags` table: every article kept
// its tags as a JSON array in `posts.tags`. Migration 0007 seeds the
// tag table from those arrays, and every save now keeps the two in
// step.
//
// The tag's URL segment is the tag NAME, encoded once — the same rule
// the public site uses for
//     /<locale>/<blog|notes>/tag/<encodeURIComponent(name)>
// so a tag created here has a working tag page.

import { useEffect, useState, type CSSProperties } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { apiDelete, apiGet, apiPatch, apiPost, errorMessage } from '@/lib/cms/api-client';
import { formatDateTime } from '@/lib/cms/format';
import { tagPathSegment } from '@/lib/cms/tags';

interface Tag {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  post_count?: number;
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
  const [formName, setFormName] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const toast = useToast();

  async function fetchTags() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ items: Tag[] }>('/api/admin/tags');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: unknown) {
      setError(errorMessage(e, '标签加载失败，请稍后重试。'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTags();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = formName.trim();
    if (!name) {
      toast.show('请填写标签名称', 'error');
      return;
    }
    try {
      // Item 5 — the slug IS the name, so the public tag page and the
      // CMS always agree on the URL.
      await apiPost('/api/admin/tags', { name, slug: name });
      toast.show('标签已创建', 'success');
      setShowForm(false);
      setFormName('');
      fetchTags();
    } catch (e: unknown) {
      toast.show(errorMessage(e, '创建失败'), 'error');
    }
  }

  async function handleRename(id: number, name: string) {
    const next = editName.trim();
    if (!next) {
      toast.show('请填写标签名称', 'error');
      return;
    }
    try {
      await apiPatch(`/api/admin/tags/${id}`, { name: next, slug: next });
      toast.show('标签已重命名，相关文章的标签已同步更新', 'success');
      setEditing(null);
      fetchTags();
    } catch (e: unknown) {
      toast.show(errorMessage(e, '重命名失败'), 'error');
    }
  }

  async function handleDelete(id: number, name: string, count?: number) {
    const extra = count ? `（${count} 篇文章正在使用）` : '';
    if (!confirm(`确认删除标签「${name}」${extra}？此操作不可撤销。`)) return;
    try {
      await apiDelete(`/api/admin/tags/${id}`);
      toast.show('标签已删除', 'success');
      fetchTags();
    } catch (e: unknown) {
      toast.show(errorMessage(e, '删除失败'), 'error');
    }
  }

  const visible = items.filter((t) =>
    search.trim() ? t.name.toLowerCase().includes(search.trim().toLowerCase()) : true
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>标签</h1>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            共 {items.length} 个标签
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标签"
            aria-label="搜索标签"
            style={{ ...inputStyle, width: 180 }}
          />
          <Button variant="primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? '取消' : '+ 新建标签'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card padding="md" style={{ marginBottom: 24 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={labelStyle}>名称</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
                placeholder="例如：日本語、Cloudflare、AI"
              />
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, marginBottom: 0 }}>
                标签的网址就是标签名本身（前台的标签页按同一规则生成）。
              </p>
            </div>
            <Button variant="primary" type="submit">创建</Button>
          </form>
        </Card>
      )}

      {error ? (
        <ErrorState
          title="加载标签失败"
          description={error}
          action={
            <Button variant="primary" onClick={fetchTags}>
              重试
            </Button>
          }
        />
      ) : loading ? (
        <TagsSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title="暂无标签"
          description="创建标签来标记文章主题。"
          action={<Button variant="primary" onClick={() => setShowForm(true)}>+ 新建标签</Button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState title="没有匹配的标签" description="换个关键词试试。" />
      ) : (
        <Card padding="none">
          <div className="admin-table-scroll">
            <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>名称</th>
                  <th style={thStyle}>文章数</th>
                  <th style={thStyle}>网址</th>
                  <th style={thStyle}>创建时间</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td style={tdStyle}>
                      {editing === t.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            style={{ ...inputStyle, width: 160 }}
                            autoFocus
                          />
                          <button style={smallButtonStyle} onClick={() => handleRename(t.id, t.name)}>
                            保存
                          </button>
                          <button style={smallButtonStyle} onClick={() => setEditing(null)}>
                            取消
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            fontSize: 12,
                            background: 'var(--color-surface-elevated)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          {t.name}
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>{t.post_count ?? 0}</td>
                    <td
                      style={{
                        ...tdStyle,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        wordBreak: 'break-all',
                      }}
                    >
                      /tag/{tagPathSegment(t.name)}
                    </td>
                    <td
                      style={{
                        ...tdStyle,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDateTime(t.created_at)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => {
                          setEditing(t.id);
                          setEditName(t.name);
                        }}
                        style={{ ...smallButtonStyle, color: 'var(--color-text-secondary)' }}
                      >
                        重命名
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.name, t.post_count)}
                        style={{ ...smallButtonStyle, color: 'var(--color-danger)' }}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function TagsSkeleton() {
  return (
    <Card padding="md">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 18, width: `${60 + (i % 3) * 12}%`, marginBottom: 14 }}
        />
      ))}
    </Card>
  );
}

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 4,
  display: 'block',
};

const smallButtonStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
  fontSize: 12,
  fontFamily: 'inherit',
  padding: '0 6px',
};

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
  whiteSpace: 'nowrap',
};

const tdStyle: CSSProperties = {
  padding: 'var(--space-md)',
  fontSize: 'var(--font-size-sm)',
  borderBottom: '1px solid var(--color-border)',
};
