// functions/api/admin/posts/index.ts
// /api/admin/posts — list (GET) + create (POST)
// Phase 2 skeleton — Phase 5 implements
// Per D-3 + D-6: posts.content stores full MDX verbatim, byte-level SoT

export const onRequestGet = async (context: any): Promise<Response> => {
  // TODO Phase 5:
  //   Query params: ?locale=ja&status=published&collection=posts&page=1&limit=20&search=...
  //   SELECT id, locale, slug, title, status, published_at, updated_at FROM posts
  //   WHERE [...filters] ORDER BY updated_at DESC LIMIT ? OFFSET ?
  //   Return { success: true, data: { posts: [...], total: N } }
  return json({ error: 'Not implemented — Phase 5' }, 501);
};

export const onRequestPost = async (context: any): Promise<Response> => {
  // TODO Phase 5:
  //   Body: { collection, locale, slug, title, description_raw, description_text, content, ... }
  //   Validate required fields
  //   Check UNIQUE(collection, locale, slug) — 409 if conflict
  //   INSERT INTO posts (...) VALUES (...)
  //   Return { success: true, data: { id } }
  return json({ error: 'Not implemented — Phase 5' }, 501);
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
