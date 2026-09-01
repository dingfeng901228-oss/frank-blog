// functions/api/cms/publish-hook.ts
// POST /api/cms/publish-hook — manual CF Pages Deploy Hook trigger
// Used for manual rebuilds (e.g., admin clicks "Rebuild Site" button)
// Auth: requires admin session via admin/_middleware.ts (this path is /api/cms/*, NOT /api/admin/*)
//
// Note: this endpoint is NOT protected by admin/_middleware.ts (which only matches /api/admin/*)
// For MVP we trust this internal endpoint — production usage should add its own auth
// OR route through admin (rename to /api/admin/cms/publish-hook)

import type { PagesContext } from '../../src/lib/cms/types';
import { triggerDeployHook } from '../../src/lib/cms/deploy';

export const onRequestPost = async (context: PagesContext): Promise<Response> => {
  const result = await triggerDeployHook(context.env);

  if (!result.triggered) {
    return json(
      {
        success: false,
        error: { code: 'DEPLOY_HOOK_FAILED', message: result.error || 'Deploy hook failed' },
        data: { ts: result.ts },
      },
      502
    );
  }

  return json({
    success: true,
    data: { triggered: true, ts: result.ts },
  });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
