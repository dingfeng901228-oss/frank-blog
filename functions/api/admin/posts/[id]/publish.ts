// functions/api/admin/posts/[id]/publish.ts
// POST /api/admin/posts/:id/publish — publish post + trigger CF Pages Deploy Hook
// Phase 2 skeleton — Phase 7 implements
// Per ADR-002: Publish triggers SSG rebuild via Deploy Hook URL

export const onRequestPost = async (context: any): Promise<Response> => {
  // TODO Phase 7:
  //   1. SELECT post FROM posts WHERE id = ?
  //   2. UPDATE posts SET status = 'published', published_at = datetime('now') WHERE id = ?
  //   3. POST env.CLOUDFLARE_DEPLOY_HOOK_URL (no body needed)
  //   4. Log to admin_logs
  //   5. Return { success: true, data: { id, status, published_at, deploy_hook_triggered: true } }
  return json(
    { error: `Not implemented — publish post ${context.params.id} (Phase 7)` },
    501
  );
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
