// src/lib/cms/deploy.ts
// Trigger CF Pages Deploy Hook to rebuild site after publish/unpublish
// Per ADR-002: only Publish + Unpublish trigger SSG rebuild (Draft/Update Draft do NOT)

import type { Env } from './types';

export interface DeployResult {
  triggered: boolean;
  error: string | null;
  ts: string;
}

/**
 * POST env.CLOUDFLARE_DEPLOY_HOOK_URL → triggers CF Pages to rebuild.
 *
 * Returns { triggered: true } if the hook returned 2xx.
 * Returns { triggered: false, error } if URL missing, network failed, or non-2xx.
 *
 * Never throws — callers decide how to surface the error to the user.
 */
export async function triggerDeployHook(env: Env): Promise<DeployResult> {
  const url = env.CLOUDFLARE_DEPLOY_HOOK_URL;
  const ts = new Date().toISOString();

  if (!url) {
    return {
      triggered: false,
      error:
        'CLOUDFLARE_DEPLOY_HOOK_URL not configured (run `wrangler pages secret put CLOUDFLARE_DEPLOY_HOOK_URL`)',
      ts,
    };
  }

  try {
    const res = await fetch(url, { method: 'POST' });
    if (res.ok) {
      return { triggered: true, error: null, ts };
    }
    return {
      triggered: false,
      error: `Deploy hook returned HTTP ${res.status}`,
      ts,
    };
  } catch (e) {
    return {
      triggered: false,
      error: e instanceof Error ? e.message : String(e),
      ts,
    };
  }
}
