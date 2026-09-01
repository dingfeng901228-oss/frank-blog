// functions/api/admin/posts/[id]/unpublish.ts
// POST /api/admin/posts/:id/unpublish — revert to draft + trigger Deploy Hook
// Phase 2 skeleton — Phase 7 implements
// Per ADR-002: Unpublish triggers SSG rebuild (removes page from production)

export const onRequestPost = async (context: any): Promise<Response> => {
  // TODO Phase 7:
  //   1. UPDATE posts SET status = 'draft', published_at = NULL WHERE id = ?
  //   2. POST env.CLOUDFLARE_DEPLOY_HOOK_URL
  //   3. Log to admin_logs
  //   4. Return { success: true, data: { id, status } }
  return json(
    { error: `Not implemented — unpublish post ${context.params.id} (Phase 7)` },
    501
  );
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
