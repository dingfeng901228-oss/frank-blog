// functions/api/admin/_middleware.ts
// Admin API middleware — runs before any /api/admin/* route
// Validates session cookie + attaches User to context.data
// Per D-4: HttpOnly Cookie session + SHA-256 token hash

import type { PagesContext } from '../../../src/lib/cms/types';
import { getSessionUser } from '../../../src/lib/cms/auth';
import { sha256Hex } from '../../../src/lib/cms/crypto';

const SESSION_COOKIE_NAME = 'cms_session';

export const onRequest = async (context: PagesContext): Promise<Response | undefined> => {
  const cookieHeader = context.request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (!sessionToken) {
    return jsonError('NOT_AUTHENTICATED', 'No session cookie', 401);
  }

  const tokenHash = await sha256Hex(sessionToken);
  const user = await getSessionUser(context.env, tokenHash);

  if (!user) {
    return jsonError('SESSION_INVALID', 'Session expired or invalid', 401);
  }

  // Attach user to context.data for downstream handlers (login/logout/me/posts/...)
  (context.data as any) = { user };

  // Pass through to matched route
  return undefined;
};

// ────────────────────────────────────────────────────
// Cookie parser (RFC 6265 §5.2 simplified)
// ────────────────────────────────────────────────────

function parseCookies(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

function jsonError(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
