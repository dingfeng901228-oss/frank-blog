// functions/api/cms/publish-hook.ts
// POST /api/cms/publish-hook — manual CF Pages Deploy Hook trigger
// Used for manual rebuilds (e.g., admin clicks "Rebuild Site" button)
// Auth: NOT under /api/admin/* middleware (no session validation)
//
// Note: this endpoint is internal-only. Production usage should add its own auth
// OR rename to /api/admin/cms/publish-hook to inherit the admin session middleware.

import type { PagesContext } from '../../cms/types';
import { triggerDeployHook } from '../../cms/deploy';

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
