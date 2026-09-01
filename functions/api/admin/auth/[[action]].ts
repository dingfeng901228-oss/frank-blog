// functions/api/admin/auth/[[action]].ts
// Auth router — handles /api/admin/auth/{login,logout,me}
// Phase 2 skeleton — Phase 3 implements
// Per D-4: admin login → admin@frank2025.com + PBKDF2-SHA256 + HttpOnly Cookie

import type { PagesHandler } from '../../../../src/lib/cms/types';

export const onRequest: PagesHandler<{ action: string }> = async (context) => {
  const { action } = context.params;
  const method = context.request.method;

  switch (action) {
    case 'login':
      if (method === 'POST') return login(context);
      break;
    case 'logout':
      if (method === 'POST') return logout(context);
      break;
    case 'me':
      if (method === 'GET') return me(context);
      break;
  }

  return json({ error: 'Method not allowed' }, 405);
};

// ────────────────────────────────────────────────────
// Stubs — Phase 3 implements
// ────────────────────────────────────────────────────

async function login(context: any): Promise<Response> {
  // TODO Phase 3:
  //   1. Parse JSON body { email, password }
  //   2. SELECT user FROM users WHERE email = ? AND status = 'active'
  //   3. verifyPassword(plain, user.password_hash)
  //   4. createSession(env, user.id) → { token, tokenHash, expiresAt }
  //   5. UPDATE users.last_login_at = datetime('now')
  //   6. Return { success: true, data: { user } } + Set-Cookie: cms_session=<token>; HttpOnly; Secure; SameSite=Lax; Max-Age=...
  //   7. On failure: 401 + { error: { code: 'INVALID_CREDENTIALS' } }
  //   8. Log attempt to admin_logs
  return json({ error: 'Not implemented — Phase 3' }, 501);
}

async function logout(context: any): Promise<Response> {
  // TODO Phase 3:
  //   1. Extract session cookie
  //   2. deleteSession(env, tokenHash)
  //   3. Clear cookie: Set-Cookie: cms_session=; Max-Age=0
  //   4. Return { success: true }
  return json({ error: 'Not implemented — Phase 3' }, 501);
}

async function me(context: any): Promise<Response> {
  // TODO Phase 3:
  //   1. Get user from context.data (set by admin/_middleware.ts)
  //   2. Return { success: true, data: { user: { id, email, role, display_name } } }
  return json({ error: 'Not implemented — Phase 3' }, 501);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
