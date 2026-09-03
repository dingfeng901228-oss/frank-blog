// functions/api/admin/posts/index.ts
// /api/admin/posts — list (GET) + create (POST)
// Per D-3 + D-6: posts.content stores full MDX verbatim, byte-level SoT

import type { PagesContext } from '../../../cms/types';
import { execute, queryAll, queryFirst } from '../../../cms/db';
import type { Locale, PostStatus, PostCollection, Post } from '../../../cms/types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ────────────────────────────────────────────────────
// GET /api/admin/posts — list with filters
// ────────────────────────────────────────────────────

export const onRequestGet = async (context: PagesContext): Promise<Response> => {
  const url = new URL(context.request.url);
  const locale    = url.searchParams.get('locale') as Locale | null;
  const status    = url.searchParams.get('status') as PostStatus | null;
  const collection = url.searchParams.get('collection') as PostCollection | null;
  const search    = url.searchParams.get('search');
  const page      = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit     = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)));
  const offset    = (page - 1) * limit;

  // Build dynamic WHERE
  const where: string[] = [];
  const params: unknown[] = [];

  if (locale) {
    where.push('locale = ?');
    params.push(locale);
  }
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (collection) {
    where.push('collection = ?');
    params.push(collection);
  }
  if (search) {
    where.push('(title LIKE ? OR slug LIKE ?)');
    const wildcard = `%${search}%`;
    params.push(wildcard, wildcard);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // Count total
  const totalRow = await queryFirst<{ n: number }>(
    context.env,
    `SELECT COUNT(*) as n FROM posts ${whereClause}`,
    params
  );
  const total = totalRow?.n ?? 0;

  // List
  const posts = await queryAll<Post>(
    context.env,
    `SELECT id, collection, locale, slug, title, status, published_at, updated_at, created_at, cover_image, is_featured
     FROM posts
     ${whereClause}
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return json({
    success: true,
    data: {
      posts,
      total,
      page,
      limit,
      has_more: offset + posts.length < total,
    },
  });
};

// ────────────────────────────────────────────────────
// POST /api/admin/posts — create new draft
// ────────────────────────────────────────────────────

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Body must be JSON' } }, 400);
  }

  // Validate required fields
  const required = ['collection', 'locale', 'slug', 'title', 'description_text', 'content'];
  for (const key of required) {
    if (typeof body[key] !== 'string' || !body[key]) {
      return json(
        { success: false, error: { code: 'INVALID_REQUEST', message: `Missing required field: ${key}` } },
        400
      );
    }
  }

  if (!['posts', 'notes'].includes(body.collection)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'collection must be "posts" or "notes"' } }, 400);
  }
  if (!['zh', 'ja', 'en'].includes(body.locale)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'locale must be zh/ja/en' } }, 400);
  }

  // Check uniqueness (UNIQUE(collection, locale, slug) will return error from SQLite if duplicate)
  const existing = await queryFirst<{ id: number }>(
    context.env,
    `SELECT id FROM posts WHERE collection = ? AND locale = ? AND slug = ?`,
    [body.collection, body.locale, body.slug]
  );
  if (existing) {
    return json(
      { success: false, error: { code: 'CONFLICT', message: `Post with slug "${body.slug}" already exists in ${body.locale}/${body.collection}` } },
      409
    );
  }

  // Build MDX frontmatter from fields
  const description_raw = buildDescriptionRaw(body.description_text);
  const publishedAt = body.published_at ?? new Date().toISOString().split('T')[0];

  const result = await execute(
    context.env,
    `INSERT INTO posts
       (collection, locale, slug, title, description_raw, description_text, content, content_format,
        excerpt, cover_image, status, published_at, author_id, reading_time, is_featured, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.collection,
      body.locale,
      body.slug,
      body.title,
      description_raw,
      body.description_text,
      body.content,
      body.content_format ?? 'mdx',
      body.excerpt ?? null,
      body.cover_image ?? null,
      body.status ?? 'draft',
      publishedAt,
      context.data?.user?.id ?? null,
      body.reading_time ?? null,
      body.is_featured ? 1 : 0,
      body.tags ? JSON.stringify(body.tags) : null,
    ]
  );

  return json(
    {
      success: true,
      data: {
        id: result.meta?.last_row_id,
        slug: body.slug,
        status: body.status ?? 'draft',
      },
    },
    201
  );
};

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────

/**
 * Build description_raw YAML scalar.
 * Single-line → double-quoted string.
 * Multi-line → folded block scalar (>) to preserve line breaks.
 * Per D-6: this format is valid YAML and round-trip safe.
 */
function buildDescriptionRaw(text: string): string {
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  if (!text.includes('\n')) {
    return `description: "${escaped}"`;
  }
  // Folded block scalar — preserves newlines as spaces at render time
  // Indented with 2 spaces under the scalar header
  const lines = text.split('\n').map((l) => '  ' + l).join('\n');
  return `description: >\n${lines}`;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
