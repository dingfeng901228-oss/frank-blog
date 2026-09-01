// functions/api/admin/posts/[id]/publish.ts
// POST /api/admin/posts/:id/publish
// Per ADR-002:
//   1. UPDATE posts SET status='published', published_at=datetime('now')
//   2. POST env.CLOUDFLARE_DEPLOY_HOOK_URL → trigger SSG rebuild
//   3. Log to admin_logs (success or failure)
//
// Note: publish succeeds in DB even if deploy hook fails.
//   (Better to have the post status correct in D1 than to fail the operation
//    due to network issues. The deploy_error field surfaces the hook problem.)

import type { PagesContext } from '../../../../src/lib/cms/types';
import { execute, queryFirst } from '../../../src/lib/cms/db';
import { triggerDeployHook } from '../../../src/lib/cms/deploy';

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  const id = parseInt(context.params.id, 10);
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  // Verify post exists
  const post = await queryFirst<{ id: number }>(
    context.env,
    `SELECT id FROM posts WHERE id = ?`,
    [id]
  );
  if (!post) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  }

  // Update status to published
  const now = new Date().toISOString();
  await execute(
    context.env,
    `UPDATE posts SET status = 'published', published_at = ?, updated_at = datetime('now') WHERE id = ?`,
    [now, id]
  );

  // Trigger deploy hook
  const deploy = await triggerDeployHook(context.env);

  // Log to admin_logs
  await execute(
    context.env,
    `INSERT INTO admin_logs (user_id, action, resource_type, resource_id) VALUES (?, ?, ?, ?)`,
    [
      context.data?.user?.id ?? null,
      deploy.triggered ? 'publish' : 'publish_failed',
      'post',
      id,
    ]
  );

  return json({
    success: deploy.triggered,
    data: {
      id,
      status: 'published',
      published_at: now,
      deploy_triggered: deploy.triggered,
      deploy_error: deploy.error,
      deploy_ts: deploy.ts,
    },
    ...(deploy.triggered
      ? {}
      : { error: { code: 'DEPLOY_HOOK_FAILED', message: deploy.error || 'Deploy hook failed' } }),
  }, deploy.triggered ? 200 : 502);
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
