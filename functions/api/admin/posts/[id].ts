// functions/api/admin/posts/[id].ts
// /api/admin/posts/:id — get (GET) / update (PUT) / delete (DELETE)
// Per D-6: content field is byte-level SoT, never transformed

import type { PagesContext } from '../../../_cms/types';
import { execute, queryFirst } from '../../../_cms/db';
import type { Post } from '../../../_cms/types';

// ────────────────────────────────────────────────────
// GET /api/admin/posts/:id
// ────────────────────────────────────────────────────

export const onRequestGet = async (context: PagesContext<{ id: string }>): Promise<Response> => {
  const id = parseInt(context.params.id, 10);
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  const post = await queryFirst<Post>(
    context.env,
    `SELECT * FROM posts WHERE id = ?`,
    [id]
  );

  if (!post) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  }

  return json({ success: true, data: post });
};

// ────────────────────────────────────────────────────
// PUT /api/admin/posts/:id
// ────────────────────────────────────────────────────

export const onRequestPut = async (context: PagesContext<{ id: string }>): Promise<Response> => {
  const id = parseInt(context.params.id, 10);
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Body must be JSON' } }, 400);
  }

  // Verify post exists
  const existing = await queryFirst<Post>(
    context.env,
    `SELECT id FROM posts WHERE id = ?`,
    [id]
  );
  if (!existing) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  }

  // Build dynamic UPDATE — only update fields provided
  const updates: string[] = [];
  const params: unknown[] = [];

  const fields: Record<string, string> = {
    title: 'title',
    description_text: 'description_text',
    content: 'content',
    excerpt: 'excerpt',
    cover_image: 'cover_image',
    status: 'status',
    published_at: 'published_at',
    reading_time: 'reading_time',
    tags: 'tags',
  };

  for (const [bodyKey, dbColumn] of Object.entries(fields)) {
    if (body[bodyKey] !== undefined) {
      let value: unknown = body[bodyKey];
      // tags is JSON-encoded
      if (bodyKey === 'tags' && Array.isArray(value)) {
        value = JSON.stringify(value);
      }
      // is_featured is integer
      if (bodyKey === 'status' && !['draft', 'published', 'archived'].includes(value as string)) {
        return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid status' } }, 400);
      }
      updates.push(`${dbColumn} = ?`);
      params.push(value);
    }
  }

  if (body.is_featured !== undefined) {
    updates.push('is_featured = ?');
    params.push(body.is_featured ? 1 : 0);
  }

  if (body.description_text !== undefined) {
    // Rebuild description_raw to keep them in sync
    const newRaw = buildDescriptionRaw(body.description_text);
    updates.push('description_raw = ?');
    params.push(newRaw);
  }

  if (updates.length === 0) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'No fields to update' } }, 400);
  }

  updates.push('updated_at = datetime(\'now\')');
  params.push(id);

  await execute(
    context.env,
    `UPDATE posts SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  return json({ success: true, data: { id, updated: true } });
};

// ────────────────────────────────────────────────────
// DELETE /api/admin/posts/:id
// ────────────────────────────────────────────────────

export const onRequestDelete = async (context: PagesContext<{ id: string }>): Promise<Response> => {
  const id = parseInt(context.params.id, 10);
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  await execute(
    context.env,
    `DELETE FROM posts WHERE id = ?`,
    [id]
  );

  return new Response(null, { status: 204 });
};

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────

function buildDescriptionRaw(text: string): string {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  if (!text.includes('\n')) {
    return `description: "${escaped}"`;
  }
  const lines = text.split('\n').map((l) => '  ' + l).join('\n');
  return `description: >\n${lines}`;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
