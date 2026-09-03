// functions/api/admin/auth/[[action]].ts
// /api/admin/auth/{login,logout,me}
// Per D-4: admin@frank2025.com + HttpOnly Cookie session + admin_logs audit

import type { PagesHandler, PagesContext, Env, User } from '../../../_cms/types';
import {
  verifyPassword,
  createSession,
  deleteSession,
  hashIp,
} from '../../../_cms/auth';
import { sha256Hex } from '../../../_cms/crypto';
import { queryFirst, execute } from '../../../_cms/db';

const SESSION_COOKIE_NAME = 'cms_session';
const SESSION_TTL_DAYS = 7;

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

  return json(
    { success: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    405
  );
};

// ────────────────────────────────────────────────────
// POST /api/admin/auth/login
// ────────────────────────────────────────────────────

async function login(context: PagesContext): Promise<Response> {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await context.request.json();
  } catch {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Body must be JSON' } }, 400);
  }

  const { email, password } = body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return json(
      { success: false, error: { code: 'INVALID_REQUEST', message: 'email + password required' } },
      400
    );
  }

  const user = await queryFirst<User>(
    context.env,
    `SELECT * FROM users WHERE email = ? AND status = 'active'`,
    [email]
  );

  const ip = context.request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ipHash = await hashIp(context.env, ip);

  if (!user) {
    await logFailedLogin(context.env, null, 'USER_NOT_FOUND', ipHash);
    return json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401
    );
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    await logFailedLogin(context.env, user.id, 'BAD_PASSWORD', ipHash);
    return json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401
    );
  }

  // Create session + update last_login_at + log success
  const { token, expiresAt } = await createSession(context.env, user.id, SESSION_TTL_DAYS);

  await execute(
    context.env,
    `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`,
    [user.id]
  );

  await execute(
    context.env,
    `INSERT INTO admin_logs (user_id, action, ip_hash) VALUES (?, 'login', ?)`,
    [user.id, ipHash]
  );

  // Set HttpOnly + Secure + SameSite=Lax cookie
  const cookieValue = [
    `${SESSION_COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_TTL_DAYS * 24 * 60 * 60}`,
  ].join('; ');

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        user: publicUser(user),
        expires_at: expiresAt,
      },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieValue,
      },
    }
  );
}

// ────────────────────────────────────────────────────
// POST /api/admin/auth/logout
// ────────────────────────────────────────────────────

async function logout(context: PagesContext): Promise<Response> {
  const cookieHeader = context.request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  const user = context.data?.user as User | undefined;
  const ip = context.request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ipHash = await hashIp(context.env, ip);

  if (sessionToken) {
    const tokenHash = await sha256Hex(sessionToken);
    await deleteSession(context.env, tokenHash);
  }

  if (user) {
    await execute(
      context.env,
      `INSERT INTO admin_logs (user_id, action, ip_hash) VALUES (?, 'logout', ?)`,
      [user.id, ipHash]
    );
  }

  // Clear cookie
  const cookieValue = `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

  return new Response(
    JSON.stringify({ success: true, data: { logged_out: true } }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieValue,
      },
    }
  );
}

// ────────────────────────────────────────────────────
// GET /api/admin/auth/me
// ────────────────────────────────────────────────────

async function me(context: PagesContext): Promise<Response> {
  const user = context.data?.user as User | undefined;
  if (!user) {
    return json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } },
      401
    );
  }

  return json({ success: true, data: { user: publicUser(user) } });
}

// ────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────

function publicUser(user: User): {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
} {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

async function logFailedLogin(
  env: Env,
  userId: number | null,
  reason: string,
  ipHash: string
): Promise<void> {
  await execute(
    env,
    `INSERT INTO admin_logs (user_id, action, ip_hash, resource_type) VALUES (?, ?, ?, ?)`,
    [userId, 'login_failed', ipHash, reason]
  );
}
