// functions/api/admin/preview/[id].ts
// GET /api/admin/preview/:id — fetch post for preview
// Per ADR-005: frontend renders via same Markdown component (src/components/Markdown.tsx)
//             Backend returns raw data; rendering happens in admin UI (Next.js client)

import type { PagesContext } from '../../../_cms/types';
import { queryFirst } from '../../../_cms/db';

export const onRequestGet = async (context: PagesContext<{ id: string }>): Promise<Response> => {
  const id = parseInt(context.params.id, 10);
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  const post = await queryFirst<any>(
    context.env,
    `SELECT id, collection, locale, slug, title, description_text, description_raw,
            content, excerpt, cover_image, status, is_featured, tags,
            published_at, updated_at, reading_time, author_id
     FROM posts WHERE id = ?`,
    [id]
  );

  if (!post) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  }

  return json({ success: true, data: post });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
