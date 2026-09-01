// functions/api/admin/posts/[id]/unpublish.ts
// POST /api/admin/posts/:id/unpublish — revert to draft + trigger Deploy Hook
// Per ADR-002: Unpublish also triggers SSG rebuild (removes page from production)

import type { PagesContext } from '../../../../src/lib/cms/types';
import { execute, queryFirst } from '../../../src/lib/cms/db';
import { triggerDeployHook } from '../../../src/lib/cms/deploy';

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  const id = parseInt(context.params.id, 10);
  if (!Number.isFinite(id)) {
    return json(
      { success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } },
      400
    );
  }

  const post = await queryFirst<{ id: number }>(
    context.env,
    `SELECT id FROM posts WHERE id = ?`,
    [id]
  );
  if (!post) {
    return json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } },
      404
    );
  }

  // Update status to draft, clear published_at
  await execute(
    context.env,
    `UPDATE posts SET status = 'draft', published_at = NULL, updated_at = datetime('now') WHERE id = ?`,
    [id]
  );

  // Trigger deploy hook (Unpublish removes page from production)
  const deploy = await triggerDeployHook(context.env);

  // Log
  await execute(
    context.env,
    `INSERT INTO admin_logs (user_id, action, resource_type, resource_id) VALUES (?, ?, ?, ?)`,
    [
      context.data?.user?.id ?? null,
      deploy.triggered ? 'unpublish_post' : 'unpublish_post_failed',
      'post',
      id,
    ]
  );

  return json(
    {
      success: deploy.triggered,
      data: {
        id,
        status: 'draft',
        deploy_triggered: deploy.triggered,
        deploy_error: deploy.error,
        deploy_ts: deploy.ts,
      },
      ...(deploy.triggered
        ? {}
        : { error: { code: 'DEPLOY_HOOK_FAILED', message: deploy.error || 'Deploy hook failed' } }),
    },
    deploy.triggered ? 200 : 502
  );
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
