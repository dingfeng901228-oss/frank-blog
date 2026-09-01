// functions/api/cms/publish-hook.ts
// POST /api/cms/publish-hook — trigger CF Pages Deploy Hook
// Phase 2 skeleton — Phase 7 implements
// Per ADR-002: CMS publishes trigger this endpoint → SSG rebuild
//
// The Deploy Hook URL is created in CF Pages Dashboard:
//   Pages project → Settings → Builds → Create hook
// URL format: https://api.cloudflare.com/client/v4/pages/webhooks/deploy-hooks/<UUID>
// Stored as env.CLOUDFLARE_DEPLOY_HOOK_URL (set via `wrangler pages secret put`)

export const onRequestPost = async (context: any): Promise<Response> => {
  // TODO Phase 7:
  //   1. Read env.CLOUDFLARE_DEPLOY_HOOK_URL
  //   2. POST to that URL (no body needed — Deploy Hook triggers CF Pages build)
  //   3. Return { success: true, data: { triggered: true, ts } }
  //   4. On error: 502 Bad Gateway with error details
  return json(
    { error: 'Not implemented — trigger CF Pages Deploy Hook (Phase 7)' },
    501
  );
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};
