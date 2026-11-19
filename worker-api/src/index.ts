// worker-api/src/index.ts
// frank-blog CMS API Worker — single entry, manual router
// Handles all /api/admin/* routes that used to live in functions/api/admin/
// (Pages Functions couldn't apply [[d1_databases]] to deployment; Worker can.)

import type { Env, User, Post, MediaRecord, CategoryRecord, TagRecord, PostCollection, ActivityEntry, PostRevision } from './cms';
import { autoTranslateSiblings, type TranslationOutcome } from './autotranslate';
// normalizeTags / normalizeTagInput / splitTag live in ./tags.
// They were USED in index.ts without ever being imported — so every
// save that carried a tag list died with a ReferenceError inside the
// request handler. The admin SPA showed that as "保存失败" and no
// version was ever written.
import { normalizeTags, normalizeTagInput, splitTag } from './tags';
import {
  queryFirst,
  queryAll,
  execute,
  verifyPassword,
  createSession,
  getSessionUser,
  deleteSession,
  hashPassword,
  triggerDeployHook,
  json,
  parseCookies,
  sha256Hex,
  hashIp,
  publicUser,
  buildSessionCookie,
  buildClearCookie,
  buildCsrfCookie,
  buildClearCsrfCookie,
  CSRF_COOKIE_NAME,
  checkRateLimit,
  buildDescriptionRaw,
  randomBytes,
  getRequestIp,
  SESSION_COOKIE_NAME,
  logFailedLogin,
  listMedia,
  getMedia,
  uploadMedia,
  deleteMedia,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listTags,
  listTagsWithUsage,
  createTag,
  updateTag,
  deleteTag,
  syncPostTags,
  setPostCategory,
  syncPostCategoryJoin,
  listRecentActivity,
  listRevisions,
  restoreRevision,
  saveDraft,
  getDB,
  createRevision,
  validateSlug,
  validateTitle,
  validateContent,
  validateDescriptionText,
  validateName,
  getCurrentUser,
  listKnownTags,
  escapeLike,
} from './cms';
import {
  handleBulk,
  handleExport,
  handleSettings,
  handleActivity,
  handleRedeploy,
  handleMediaUpdate,
  handleMediaUsage,
  publishScheduledPosts,
  ensureSiteInSync,
  getSiteStatus,
} from './admin-ext';

const SESSION_TTL_DAYS = 7;

// Phase C2 §37 — CSRF double-submit cookie enforcement
// Skips: GET + OPTIONS + /api/admin/auth/login (user not authenticated yet).
// All other state-changing endpoints (POST/PUT/DELETE under /api/admin/*) must
// carry the same token in the X-CSRF-Token header as in the cms_csrf cookie.
function checkCsrfIfNeeded(request: Request, path: string, method: string): Response | null {
  if (method === 'GET' || method === 'OPTIONS') return null;
  if (path === '/api/admin/auth/login') return null;
  if (!path.startsWith('/api/admin/')) return null;

  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = request.headers.get('X-CSRF-Token');

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return json(
      {
        success: false,
        error: { code: 'CSRF_INVALID', message: 'CSRF token missing or invalid' },
      },
      403
    );
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// CSRF cookie refresh — Phase C2d §37
// Sessions created BEFORE CSRF protection shipped (or after the cms_csrf cookie
// expired/was cleared) still authenticate via cms_session, but have no csrf
// token to echo. The admin SPA would otherwise be locked out until the user
// logs out and back in. This endpoint issues a fresh cms_csrf cookie for any
// already-authenticated session.
//
// GET /api/admin/auth/csrf — issues Set-Cookie cms_csrf (same double-submit
// value as the one the browser will mirror as X-CSRF-Token). Returns 401 if
// the session is also gone (caller should redirect to /admin/login).
// ────────────────────────────────────────────────────────────────────────────

async function refreshCsrf(request: Request, env: Env): Promise<Response> {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (!sessionToken) {
    return json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } },
      401
    );
  }
  const tokenHash = await sha256Hex(sessionToken);

  // Re-fetch session row directly so we can match the existing cookie expiry.
  // Reusing the same expires_at keeps CSRF lifetime tied to the session — no
  // cookie can outlive the session that minted it.
  const session = await queryFirst<{ user_id: number; expires_at: string }>(
    env,
    `SELECT user_id, expires_at FROM sessions WHERE token_hash = ?`,
    [tokenHash]
  );
  if (!session) {
    return json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } },
      401
    );
  }
  if (new Date(session.expires_at).getTime() < Date.now()) {
    await deleteSession(env, tokenHash);
    return json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Session expired' } },
      401
    );
  }

  const user = await getSessionUser(env, tokenHash);
  if (!user) {
    return json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } },
      401
    );
  }

  const csrfToken = randomBytes(32)
    .reduce((hex, b) => hex + b.toString(16).padStart(2, '0'), '');

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.append('Set-Cookie', buildCsrfCookie(csrfToken, session.expires_at));
  return new Response(
    JSON.stringify({ success: true, data: { csrf_token: csrfToken } }),
    { status: 200, headers }
  );
}

// ────────────────────────────────────────────────────
// Default export — Worker entry point
// ────────────────────────────────────────────────────

export default {
  /**
   * Every API call goes through here.
   *
   * A handler that throws (a D1 query against a column that does not
   * exist, a bug, a malformed request) used to escape the Worker and
   * reach the browser as an HTML error page or a bare 500. The admin SPA
   * then read `data.error.message` off a response that had no `error`
   * object and threw "Cannot read properties of undefined (reading
   * 'message')" — which is what the user saw on /admin/categories/.
   *
   * So: catch everything here, log the raw error to the activity log
   * and the console, and answer with the standard envelope carrying a
   * human-readable message. The admin SPA never sees a stack trace.
   */
  async fetch(request: Request, env: Env, _ctx: any): Promise<Response> {
    try {
      return await route(request, env);
    } catch (e: any) {
      const detail = String(e?.message || e);
      console.error('[api] unhandled error:', detail, e?.stack || '');
      try {
        await execute(
          env,
          `INSERT INTO admin_logs (action, resource_type, message) VALUES ('api_error', ?, ?)`,
          [new URL(request.url).pathname, detail]
        );
      } catch {
        /* logging must never mask the original error */
      }
      return json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: '服务器内部错误，请稍后重试。如果持续出现，请联系管理员。',
          },
        },
        500
      );
    }
  },

  /**
   * Cron trigger — runs every 5 minutes.
   *
   * Two jobs:
   *   1. Publish every draft whose scheduled time has come.
   *   2. The reconciliation safety net: if the live site no longer
   *      matches the database, rebuild it. This is what stops a write
   *      path that forgets the deploy hook from leaving the site
   *      serving stale content.
   */
  async scheduled(_event: any, env: Env, _ctx: any): Promise<void> {
    try {
      const n = await publishScheduledPosts(env);
      if (n > 0) console.log(`[cron] published ${n} scheduled post(s)`);
    } catch (e: any) {
      console.error('[cron] scheduled publish failed:', e?.message || e);
    }
    try {
      const sync = await ensureSiteInSync(env);
      if (sync.triggered) {
        console.log(`[cron] site was out of date — rebuild triggered: ${sync.reason}`);
      } else if (sync.stale) {
        console.log(`[cron] site out of date (no rebuild): ${sync.reason}`);
      }
    } catch (e: any) {
      console.error('[cron] reconciliation failed:', e?.message || e);
    }
  },
};

async function route(request: Request, env: Env): Promise<Response> {
  {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight (defensive — same-origin via Workers Routes, but
    // admin SPA may be served from different origin if user changes DNS later)
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    // Phase C2b §37 — per-IP rate limit (60 req/min) before CSRF check
    const rateLimitCheck = await checkRateLimit(env.RATE_LIMIT, request);
    if (rateLimitCheck) return rateLimitCheck;

    // Phase C2 §37 — enforce double-submit CSRF cookie on state-changing /api/admin/* requests
    const csrfCheck = checkCsrfIfNeeded(request, path, method);
    if (csrfCheck) return csrfCheck;

    // /api/admin/auth/*
    if (path === '/api/admin/auth/login' && method === 'POST') return login(request, env);
    if (path === '/api/admin/auth/logout' && method === 'POST') return logout(request, env);
    if (path === '/api/admin/auth/me' && method === 'GET') return me(request, env);
    // POST /api/admin/auth/change-password — rotate the current user's
    // password. Requires the existing password (defence-in-depth: a stolen
    // cookie alone isn't enough to lock the real owner out). The new
    // hash is minted with the same PBKDF2-SHA256 format the seed script uses.
    if (path === '/api/admin/auth/change-password' && method === 'POST') {
      return changePassword(request, env);
    }
    // GET /api/admin/auth/csrf — refresh cms_csrf cookie for already-authenticated
    // sessions that don't have one yet (Phase C2d). Without this, sessions minted
    // before CSRF shipped would be locked out of every state-changing endpoint.
    if (path === '/api/admin/auth/csrf' && method === 'GET') return refreshCsrf(request, env);

    // /api/admin/posts
    if (path === '/api/admin/posts') {
      if (method === 'GET') return listPosts(request, env);
      if (method === 'POST') return createPost(request, env);
    }

    // /api/admin/posts/:id
    let m: RegExpMatchArray | null;
    m = path.match(/^\/api\/admin\/posts\/(\d+)$/);
    if (m) {
      const id = parseInt(m[1], 10);
      if (method === 'GET') return getPost(request, env, id);
      if (method === 'PUT') return updatePost(request, env, id);
      if (method === 'PATCH') return saveDraftHandler(request, env, id);
      if (method === 'DELETE') return deletePost(request, env, id);
    }

    // /api/admin/posts/:id/publish
    m = path.match(/^\/api\/admin\/posts\/(\d+)\/publish$/);
    if (m && method === 'POST') return publishPost(request, env, parseInt(m[1], 10));

    // /api/admin/posts/:id/retranslate — explicit re-translation of one
    // target locale, overwriting that locale's row.
    m = path.match(/^\/api\/admin\/posts\/(\d+)\/retranslate$/);
    if (m && method === 'POST') return retranslatePost(request, env, parseInt(m[1], 10));

    // /api/admin/posts/bulk-publish
    // NOTE: registered BEFORE the /:id/publish matcher isn't strictly
    // required (the path doesn't match the digit-only :id regex), but we
    // group it here so the related bulk endpoints sit together.
    if (path === '/api/admin/posts/bulk-publish' && method === 'POST') {
      return bulkPublishPosts(request, env);
    }

    // /api/admin/posts/:id/unpublish
    m = path.match(/^\/api\/admin\/posts\/(\d+)\/unpublish$/);
    if (m && method === 'POST') return unpublishPost(request, env, parseInt(m[1], 10));

    // /api/admin/preview/:id
    m = path.match(/^\/api\/admin\/preview\/(\d+)$/);
    if (m && method === 'GET') return previewPost(request, env, parseInt(m[1], 10));

    // /api/admin/media (Phase 4 — Media Library)
    if (path === '/api/admin/media' && method === 'GET') return listMediaHandler(request, env);
    if (path === '/api/admin/media/upload' && method === 'POST') return uploadMediaHandler(request, env);

    // /api/admin/media/:id
    m = path.match(/^\/api\/admin\/media\/(\d+)$/);
    if (m && method === 'DELETE') return deleteMediaHandler(request, env, parseInt(m[1], 10));

    // /api/admin/categories (Phase 5)
    if (path === '/api/admin/categories') {
      if (method === 'GET') return listCategoriesHandler(request, env);
      if (method === 'POST') return createCategoryHandler(request, env);
    }
    m = path.match(/^\/api\/admin\/categories\/(\d+)$/);
    if (m) {
      const id = parseInt(m[1], 10);
      if (method === 'PUT') return updateCategoryHandler(request, env, id);
      if (method === 'DELETE') return deleteCategoryHandler(request, env, id);
    }

    // /api/admin/tags (Phase 5)
    if (path === '/api/admin/tags') {
      if (method === 'GET') return listTagsHandler(request, env);
      if (method === 'POST') return createTagHandler(request, env);
    }
    m = path.match(/^\/api\/admin\/tags\/(\d+)$/);
    if (m) {
      const id = parseInt(m[1], 10);
      if (method === 'PUT') return updateTagHandler(request, env, id);
      if (method === 'DELETE') return deleteTagHandler(request, env, id);
    }

    // /api/admin/activity/recent (Phase 6)
    if (path === '/api/admin/activity/recent' && method === 'GET') return listRecentActivityHandler(request, env);

    // /api/admin/site/status — is the live site in sync with the
    // database? (read-only; the cron does the rebuilding)
    if (path === '/api/admin/site/status' && method === 'GET') {
      const user = await getCurrentUser(request, env);
      if (!user) {
        return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
      }
      return json({ success: true, data: await getSiteStatus(env) });
    }

    // /api/admin/site/reconcile — check and, if the site is behind,
    // rebuild it right now. The cron does this every 5 minutes; this
    // endpoint is the "check now" button.
    if (path === '/api/admin/site/reconcile' && method === 'POST') {
      const user = await getCurrentUser(request, env);
      if (!user) {
        return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
      }
      const result = await ensureSiteInSync(env);
      return json({ success: true, data: result });
    }

    // /api/admin/posts/:id/redeploy — retry a failed deploy (item 15).
    m = path.match(/^\/api\/admin\/posts\/(\d+)\/redeploy$/);
    if (m && method === 'POST') return handleRedeploy(request, env, parseInt(m[1], 10));

    // /api/admin/posts/bulk — batch publish / archive / delete / move.
    if (path === '/api/admin/posts/bulk' && method === 'POST') return handleBulk(request, env);

    // /api/admin/export — the full data export (item 16).
    if (path === '/api/admin/export' && method === 'GET') return handleExport(request, env);

    // /api/admin/settings — site settings (item 16).
    if (path === '/api/admin/settings') return handleSettings(request, env);

    // /api/admin/activity — the filtered activity log (items 2 + 15).
    if (path === '/api/admin/activity' && method === 'GET') return handleActivity(request, env);
    m = path.match(/^\/api\/admin\/activity\/(\d+)$/);
    if (m && method === 'GET') return handleActivity(request, env, parseInt(m[1], 10));

    // /api/admin/media/usage — which articles reference an asset (item 14).
    if (path === '/api/admin/media/usage' && method === 'GET') return handleMediaUsage(request, env);
    m = path.match(/^\/api\/admin\/media\/(\d+)$/);
    if (m && method === 'PUT') return handleMediaUpdate(request, env, parseInt(m[1], 10));

    // /api/admin/posts/:id/revisions + restore (Phase 6)
    m = path.match(/^\/api\/admin\/posts\/(\d+)\/revisions$/);
    if (m && method === 'GET') return listRevisionsHandler(request, env, parseInt(m[1], 10));
    m = path.match(/^\/api\/admin\/posts\/(\d+)\/revisions\/(\d+)\/restore$/);
    if (m && method === 'POST') return restoreRevisionHandler(request, env, parseInt(m[2], 10));

    return json(
      { success: false, error: { code: 'NOT_FOUND', message: '接口不存在' } },
      404
    );
  }
}

// ────────────────────────────────────────────────────
// /api/admin/auth/* handlers
// ────────────────────────────────────────────────────

async function login(request: Request, env: Env): Promise<Response> {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
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
    env,
    `SELECT * FROM users WHERE email = ? AND status = 'active'`,
    [email]
  );

  const ip = getRequestIp(request);
  const ipHash = await hashIp(env, ip);

  if (!user) {
    await logFailedLogin(env, null, 'USER_NOT_FOUND', ipHash);
    return json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401
    );
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    await logFailedLogin(env, user.id, 'BAD_PASSWORD', ipHash);
    return json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      401
    );
  }

  const { token, expiresAt } = await createSession(env, user.id, SESSION_TTL_DAYS);

  // Phase C2 §37 — CSRF token (double-submit cookie pattern).
  // Random 32 bytes hex; same value mirrored to client via Set-Cookie AND
  // echoed in JSON body. Browser JS reads cookie to set X-CSRF-Token header.
  const csrfToken = randomBytes(32)
    .reduce((hex, b) => hex + b.toString(16).padStart(2, '0'), '');

  await execute(env, `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, [user.id]);
  await execute(
    env,
    `INSERT INTO admin_logs (user_id, action, ip_hash) VALUES (?, 'login', ?)`,
    [user.id, ipHash]
  );

  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', 'application/json');
  responseHeaders.append('Set-Cookie', buildSessionCookie(token, expiresAt));
  responseHeaders.append('Set-Cookie', buildCsrfCookie(csrfToken, expiresAt));

  return new Response(
    JSON.stringify({
      success: true,
      data: { user: publicUser(user), expires_at: expiresAt, csrf_token: csrfToken },
    }),
    { status: 200, headers: responseHeaders }
  );
}

async function logout(request: Request, env: Env): Promise<Response> {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  const ip = getRequestIp(request);
  const ipHash = await hashIp(env, ip);

  let userId: number | null = null;
  if (sessionToken) {
    const tokenHash = await sha256Hex(sessionToken);
    const u = await getSessionUser(env, tokenHash);
    userId = u?.id ?? null;
    await deleteSession(env, tokenHash);
  }

  if (userId !== null) {
    await execute(
      env,
      `INSERT INTO admin_logs (user_id, action, ip_hash) VALUES (?, 'logout', ?)`,
      [userId, ipHash]
    );
  }

  // Phase C2 §37 — also clear CSRF cookie on logout
  const logoutHeaders = new Headers();
  logoutHeaders.set('Content-Type', 'application/json');
  logoutHeaders.append('Set-Cookie', buildClearCookie());
  logoutHeaders.append('Set-Cookie', buildClearCsrfCookie());

  return new Response(
    JSON.stringify({ success: true, data: { logged_out: true } }),
    { status: 200, headers: logoutHeaders }
  );
}

async function me(request: Request, env: Env): Promise<Response> {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (!sessionToken) {
    return json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } },
      401
    );
  }

  const tokenHash = await sha256Hex(sessionToken);
  const user = await getSessionUser(env, tokenHash);
  if (!user) {
    return json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } },
      401
    );
  }

  return json({ success: true, data: { user: publicUser(user) } });
}

// POST /api/admin/auth/change-password
// Body: { current_password, new_password }
// Validates current_password against the user's stored hash, then writes a
// fresh PBKDF2-SHA256 hash for new_password. Active sessions are NOT
// invalidated — the old cookie stays usable until it expires naturally.
// (If you ever add 'log out everywhere' you wipe sessions here too.)
async function changePassword(request: Request, env: Env): Promise<Response> {
  let body: { current_password?: unknown; new_password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json(
      { success: false, error: { code: 'INVALID_REQUEST', message: 'Body must be JSON' } },
      400
    );
  }

  const current = typeof body.current_password === 'string' ? body.current_password : '';
  const next = typeof body.new_password === 'string' ? body.new_password : '';

  if (!current || !next) {
    return json(
      {
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'current_password and new_password required' },
      },
      400
    );
  }
  // Mirror the login validation floor so a weak password can't lock the user
  // out of a weaker one. 8 chars is the minimum we accept anywhere.
  if (next.length < 8) {
    return json(
      { success: false, error: { code: 'INVALID_REQUEST', message: '新密码至少 8 位' } },
      400
    );
  }

  const user = await getCurrentUser(request, env);
  if (!user) {
    return json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } },
      401
    );
  }

  const currentOk = await verifyPassword(current, user.password_hash);
  if (!currentOk) {
    return json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: '当前密码不正确' } },
      401
    );
  }

  const newHash = await hashPassword(next);
  await execute(env, `UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, user.id]);

  return json({ success: true });
}

// ────────────────────────────────────────────────────
// /api/admin/media handlers (Phase 4 — Media Library)
// ────────────────────────────────────────────────────

async function listMediaHandler(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const search = url.searchParams.get('search') ?? undefined;
  // Item 14 — 按日期筛选.
  const from = url.searchParams.get('from') ?? undefined;
  const to = url.searchParams.get('to') ?? undefined;
  const result = await listMedia(env, { limit, offset, search, from, to });
  return json({ success: true, data: result });
}

async function uploadMediaHandler(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  try {
    const formData = await request.formData();
    const fileEntry = formData.get('file');
    if (!fileEntry || typeof fileEntry === 'string') {
      return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'No file uploaded (use multipart field "file")' } }, 400);
    }
    const file = fileEntry as File;
    const alt = (formData.get('alt') as string) || '';
    const arrayBuffer = await file.arrayBuffer();
    const record = await uploadMedia(
      env,
      { name: file.name, type: file.type, size: file.size, data: arrayBuffer },
      alt,
      user.id
    );
    return json({ success: true, data: record }, 201);
  } catch (e: any) {
    return json(
      { success: false, error: { code: 'INVALID_REQUEST', message: e?.message || 'Upload failed' } },
      e?.message?.includes('binding') ? 503 : 400
    );
  }
}

async function deleteMediaHandler(request: Request, env: Env, id: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  try {
    await deleteMedia(env, id);
    return new Response(null, { status: 204 });
  } catch (e: any) {
    const msg = e?.message || 'Delete failed';
    const status = msg.includes('used by') ? 409 : 404;
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: msg } }, status);
  }
}

// ────────────────────────────────────────────────────
// /api/admin/categories handlers (Phase 5)
// ────────────────────────────────────────────────────

async function listCategoriesHandler(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  const url = new URL(request.url);
  const collectionParam = url.searchParams.get('collection');
  const collection = (collectionParam === 'posts' || collectionParam === 'notes') ? collectionParam : undefined;
  const items = await listCategories(env, collection);
  return json({ success: true, data: { items } });
}

async function createCategoryHandler(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  try {
    const body = await request.json() as { name?: string; slug?: string; collection?: string };
    if (!body.name || !body.slug || !body.collection) {
      return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'name, slug, collection required' } }, 400);
    }
    if (body.collection !== 'posts' && body.collection !== 'notes') {
      return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'collection must be "posts" or "notes"' } }, 400);
    }
    // SECURITY.md #4 #5 — slug format + length validation
    validateSlug(body.slug);
    validateName(body.name, 'name');
    const cat = await createCategory(env, body.name, body.slug, body.collection);
    return json({ success: true, data: cat }, 201);
  } catch (e: any) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: e?.message || 'Create failed' } }, 400);
  }
}

async function updateCategoryHandler(request: Request, env: Env, id: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  try {
    const body = await request.json() as { name?: string; slug?: string };
    if (!body.name || !body.slug) {
      return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'name, slug required' } }, 400);
    }
    validateSlug(body.slug);
    validateName(body.name, 'name');
    await updateCategory(env, id, body.name, body.slug);
    return json({ success: true });
  } catch (e: any) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: e?.message || 'Update failed' } }, 400);
  }
}

async function deleteCategoryHandler(request: Request, env: Env, id: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  try {
    await deleteCategory(env, id);
    return new Response(null, { status: 204 });
  } catch (e: any) {
    const msg = e?.message || 'Delete failed';
    const status = msg.includes('still use') ? 409 : 404;
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: msg } }, status);
  }
}

// ────────────────────────────────────────────────────
// /api/admin/tags handlers (Phase 5)
// ────────────────────────────────────────────────────

async function listTagsHandler(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  // Item 5 — the list carries a usage count so the admin can see how many
  // articles carry each tag, and so "delete" can refuse to orphan them.
  const items = await listTagsWithUsage(env);
  return json({ success: true, data: { items } });
}

async function createTagHandler(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  try {
    const body = await request.json() as { name?: string; slug?: string };
    if (!body.name) {
      return json({ success: false, error: { code: 'INVALID_REQUEST', message: '标签名称不能为空' } }, 400);
    }
    const name = validateName(body.name, 'name');
    // Item 5 — the tag's URL segment is the tag NAME, encoded once.
    // The public site builds its tag pages as
    //   /<locale>/<collection>/tag/<encodeURIComponent(name)>
    // so the CMS has to use the same string, otherwise a tag created here
    // would 404 on the public site. The slug therefore mirrors the name.
    const slug = body.slug && body.slug !== name ? validateSlug(body.slug) : name;
    const tag = await createTag(env, name, slug);
    // A new tag only changes the site once an article carries it, but
    // the tag pages are generated from the tag list, so the site is
    // rebuilt here too.
    const deploy = await triggerDeployHook(env);
    return json(
      {
        success: true,
        data: { ...tag, deploy_triggered: deploy.triggered, deploy_error: deploy.error },
      },
      201
    );
  } catch (e: any) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: e?.message || '创建失败' } }, 400);
  }
}

async function updateTagHandler(request: Request, env: Env, id: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  try {
    const body = await request.json() as { name?: string; slug?: string };
    if (!body.name) {
      return json({ success: false, error: { code: 'INVALID_REQUEST', message: '标签名称不能为空' } }, 400);
    }
    const name = validateName(body.name, 'name');
    const slug = body.slug && body.slug !== name ? validateSlug(body.slug) : name;
    await updateTag(env, id, name, slug);
    // A rename has to follow through to the articles that carry it,
    // otherwise the tag page and the articles disagree.
    await renameTagInPosts(env, id, name);
    // The tag page on the public site is generated from the tag NAME,
    // so a rename changes the site: /tag/<old> disappears and
    // /tag/<new> appears. The site has to be rebuilt for that.
    const deploy = await triggerDeployHook(env);
    return json({
      success: true,
      data: { id, name, slug, deploy_triggered: deploy.triggered, deploy_error: deploy.error },
    });
  } catch (e: any) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: e?.message || '更新失败' } }, 400);
  }
}

/**
 * Rename a tag everywhere it is used.
 *
 * `posts.tags` is a JSON array, so the rename has to be done row by row
 * in JS rather than in SQL.
 */
async function renameTagInPosts(env: Env, tagId: number, newName: string): Promise<void> {
  const tag = await queryFirst<{ name: string }>(env, `SELECT name FROM tags WHERE id = ?`, [tagId]);
  if (!tag || tag.name === newName) return;
  const rows = await queryAll<{ id: number; tags: string | null }>(
    env,
    `SELECT id, tags FROM posts WHERE tags LIKE ?`,
    [`%${tag.name}%`]
  );
  for (const row of rows) {
    let list: string[] = [];
    try {
      const parsed = JSON.parse(row.tags ?? '[]');
      if (Array.isArray(parsed)) list = parsed.map(String);
    } catch {
      continue;
    }
    if (!list.includes(tag.name)) continue;
    const next = list.map((t) => (t === tag.name ? newName : t));
    await execute(env, `UPDATE posts SET tags = ?, updated_at = datetime('now') WHERE id = ?`, [
      JSON.stringify(next),
      row.id,
    ]);
  }
}

async function deleteTagHandler(request: Request, env: Env, id: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  try {
    await deleteTag(env, id);
    // The public site has a page per tag, so deleting a tag changes the
    // site. Without this rebuild the tag page kept showing the deleted
    // tag until something else happened to trigger a build.
    const deploy = await triggerDeployHook(env);
    return json({
      success: true,
      data: { id, deleted: true, deploy_triggered: deploy.triggered, deploy_error: deploy.error },
    });
  } catch (e: any) {
    const msg = e?.message || '删除失败';
    const status = msg.includes('still use') ? 409 : 404;
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: msg } }, status);
  }
}

// ────────────────────────────────────────────────────
// /api/admin/activity + /api/admin/posts/:id/revisions handlers (Phase 6)
// ────────────────────────────────────────────────────

async function listRecentActivityHandler(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const items = await listRecentActivity(env, limit);
  return json({ success: true, data: { items } });
}

async function listRevisionsHandler(request: Request, env: Env, postId: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  const items = await listRevisions(env, postId);
  return json({ success: true, data: { items } });
}

async function restoreRevisionHandler(request: Request, env: Env, revisionId: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  try {
    await restoreRevision(env, revisionId);
    // Restoring a version puts old content back into the article, so
    // the published page on the site changes. This path used to skip
    // the rebuild, which left the front end showing the newer text.
    const deploy = await triggerDeployHook(env);
    return json({
      success: true,
      data: { deploy_triggered: deploy.triggered, deploy_error: deploy.error },
    });
  } catch (e: any) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: e?.message || '恢复失败' } }, 404);
  }
}

// Phase A §19 — auto-save handler. PATCH /api/admin/posts/:id
// Updates only title/slug/content/description_text (NOT status, NOT other fields).
// Returns 200 success; client triggers refetch via fetchPost().
async function saveDraftHandler(request: Request, env: Env, id: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Body must be JSON' } }, 400);
  }
  // SECURITY.md #4 #5 — validate auto-save payload before UPDATE.
  // Partial update: validate and write only the fields actually sent.
  // The editor's auto-save omits `slug` on purpose so a half-typed slug
  // can never move the article's public URL.
  const fields: {
    title?: string;
    slug?: string;
    content?: string;
    description_text?: string;
  } = {};
  try {
    if (body.title !== undefined) fields.title = validateTitle(body.title);
    if (body.slug !== undefined) fields.slug = validateSlug(body.slug);
    if (body.content !== undefined) fields.content = validateContent(body.content);
    if (body.description_text !== undefined) {
      fields.description_text = validateDescriptionText(body.description_text);
    }
  } catch (e: any) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: e?.message || 'Invalid field' } }, 400);
  }
  if (Object.keys(fields).length === 0) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'No fields to update' } }, 400);
  }
  const updated = await saveDraft(env, id, fields);
  // Return the new updated_at so the client can refresh its optimistic-lock
  // token. This is what stops auto-save from causing a 409 on the next
  // manual Save/Publish.
  return json({ success: true, data: { updated_at: updated?.updated_at ?? null } });
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

async function listPosts(request: Request, env: Env): Promise<Response> {
  // SECURITY: any authenticated user can list posts (admins only per ADR-004).
  // Without this check, unauthenticated callers can read drafts + private content.
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  const url = new URL(request.url);
  const locale = url.searchParams.get('locale');
  const status = url.searchParams.get('status');
  const collection = url.searchParams.get('collection');
  const search = url.searchParams.get('search');
  const categoryId = url.searchParams.get('category_id');
  const tag = url.searchParams.get('tag');
  // Item 7 — one row per article, with the language versions nested.
  const grouped = url.searchParams.get('group') === 'article';
  // Item 12 — sorting.
  const sort = url.searchParams.get('sort') || 'updated_at';
  const order = (url.searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)));
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const params: unknown[] = [];

  if (locale) { where.push('p.locale = ?'); params.push(locale); }
  if (status) { where.push('p.status = ?'); params.push(status); }
  if (collection) { where.push('p.collection = ?'); params.push(collection); }
  if (categoryId) {
    where.push('p.category_id = ?');
    params.push(Number(categoryId));
  }
  if (tag) {
    where.push('EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id AND t.name = ?)');
    params.push(tag);
  }
  if (search) {
    // instr() instead of LIKE: a literal substring search, so a "_" in
    // a title or slug is not treated as a wildcard.
    where.push('(instr(p.title, ?) > 0 OR instr(p.slug, ?) > 0)');
    params.push(search, search);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  // Item 12 — only allow the columns we actually sort by.
  const sortColumn =
    sort === 'published_at'
      ? 'published_at'
      : sort === 'title'
        ? 'title'
        : sort === 'created_at'
          ? 'created_at'
          : 'updated_at';

  if (grouped) {
    // One row per article. The language versions are nested in `locales`.
    const totalRow = await queryFirst<{ n: number }>(
      env,
      `SELECT COUNT(DISTINCT p.collection || '|' || p.slug) as n FROM posts p ${whereClause}`,
      params
    );
    const total = totalRow?.n ?? 0;

    const rows = await queryAll<any>(
      env,
      `SELECT p.collection AS collection,
              p.slug AS slug,
              MAX(p.updated_at) AS updated_at,
              MAX(COALESCE(p.published_at, '')) AS published_at,
              MAX(p.created_at) AS created_at,
              MAX(p.category_id) AS category_id,
              MAX(c.name) AS category_name,
              json_group_array(json_object(
                'id', p.id,
                'locale', p.locale,
                'title', p.title,
                'status', p.status,
                'updated_at', p.updated_at,
                'published_at', p.published_at,
                'cover_image', p.cover_image,
                'auto_translated', p.auto_translated,
                'scheduled_at', p.scheduled_at
              )) AS locales
       FROM posts p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereClause}
       GROUP BY p.collection, p.slug
       ORDER BY MAX(p.${sortColumn}) ${order}, p.slug ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const articles = rows.map((row: any) => {
      let locales: any[] = [];
      try {
        const parsed = JSON.parse(row.locales || '[]');
        if (Array.isArray(parsed)) locales = parsed;
      } catch {
        locales = [];
      }
      locales.sort((a, b) => String(a.locale).localeCompare(String(b.locale)));
      // The article's status is the "best" of its versions: published
      // beats draft beats archived.
      const rank: Record<string, number> = { published: 3, draft: 2, archived: 1 };
      const status = locales.reduce(
        (best: string, l: any) => ((rank[l.status] ?? 0) > (rank[best] ?? 0) ? l.status : best),
        'draft'
      );
      const primary = locales.find((l) => l.locale === 'ja') || locales[0] || null;
      return {
        id: primary?.id ?? null,
        collection: row.collection,
        slug: row.slug,
        title: primary?.title ?? '',
        status,
        updated_at: row.updated_at,
        published_at: row.published_at || null,
        created_at: row.created_at,
        category_id: row.category_id,
        category_name: row.category_name,
        cover_image: primary?.cover_image ?? null,
        locales,
      };
    });

    return json({
      success: true,
      data: { posts: articles, total, page, limit, has_more: offset + articles.length < total, grouped: true },
    });
  }

  const totalRow = await queryFirst<{ n: number }>(
    env,
    `SELECT COUNT(*) as n FROM posts p ${whereClause}`,
    params
  );
  const total = totalRow?.n ?? 0;

  // Item 6 — the list carries the category, so the table can show a
  // 分类 column without a second request.
  const posts = await queryAll<Post>(
    env,
    `SELECT p.id, p.collection, p.locale, p.slug, p.title, p.status, p.published_at,
            p.updated_at, p.created_at, p.cover_image, p.is_featured, p.auto_translated,
            p.category_id, p.scheduled_at, c.name AS category_name
     FROM posts p
     LEFT JOIN categories c ON c.id = p.category_id
     ${whereClause}
     ORDER BY p.${sortColumn} ${order}, p.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return json({
    success: true,
    data: { posts, total, page, limit, has_more: offset + posts.length < total, grouped: false },
  });
}

async function createPost(request: Request, env: Env): Promise<Response> {
  // SECURITY — this endpoint used to have NO session check at all.
  // The CSRF check is a double-submit check (header vs cookie), which
  // an attacker can satisfy with their own values, so an unauthenticated
  // caller could create and publish articles on the live site. Every
  // other write path (update / delete / publish / bulk) checks the
  // session; this one did not.
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Body must be JSON' } }, 400);
  }

  const required = ['collection', 'locale', 'slug', 'title', 'description_text', 'content'];
  for (const key of required) {
    if (typeof body[key] !== 'string' || !body[key]) {
      return json(
        { success: false, error: { code: 'INVALID_REQUEST', message: `Missing required field: ${key}` } },
        400
      );
    }
  }

  if (!['posts', 'notes'].includes(body.collection)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'collection must be "posts" or "notes"' } }, 400);
  }
  if (!['zh', 'ja', 'en'].includes(body.locale)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'locale must be zh/ja/en' } }, 400);
  }

  // SECURITY.md #4 #5 — validate slug format + field length caps before
  // hitting D1 (avoids wasting a write on bad input).
  try {
    validateSlug(body.slug);
    validateTitle(body.title);
    validateContent(body.content);
    validateDescriptionText(body.description_text);
  } catch (e: any) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: e?.message || 'Invalid field' } }, 400);
  }

  const existing = await queryFirst<{ id: number }>(
    env,
    `SELECT id FROM posts WHERE collection = ? AND locale = ? AND slug = ?`,
    [body.collection, body.locale, body.slug]
  );
  if (existing) {
    return json(
      { success: false, error: { code: 'CONFLICT', message: `Post with slug "${body.slug}" already exists in ${body.locale}/${body.collection}` } },
      409
    );
  }

  const description_raw = buildDescriptionRaw(body.description_text);
  /*
   * The publication DATE, not a timestamp.
   *
   * It used to be `new Date().toISOString().split('T')[0]` — the UTC
   * date. The site is written for a Tokyo audience and the front end
   * renders the date as a plain calendar day, so an article published at
   * 08:30 JST (23:30 UTC the day before) was stamped with the PREVIOUS
   * day. Format the date in the site's own timezone instead.
   */
  const publishedAt =
    body.published_at ??
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  // Tags are normalized before they are stored: two tags pasted together
  // with a period are split back apart, so every tag on the site has a
  // working tag page. See worker-api/src/tags.ts for the rule.
  const knownTags = await listKnownTags(env);
  const normalizedTags = normalizeTags(body.tags, knownTags);

  // Item 6 — the category the article belongs to.
  const categoryId =
    body.category_id === undefined || body.category_id === null ? null : Number(body.category_id);
  // Item 9 — a future scheduled time means "publish it at that time",
  // so the row starts as a draft.
  let scheduledAt: string | null = null;
  if (body.scheduled_at) {
    scheduledAt = String(body.scheduled_at).replace('T', ' ').slice(0, 16).padEnd(19, ':00');
  }
  const scheduledInFuture =
    scheduledAt !== null && scheduledAt > new Date().toISOString().replace('T', ' ').slice(0, 19);
  const initialStatus =
    scheduledInFuture && body.status === 'published' ? 'draft' : (body.status ?? 'draft');

  const result = await execute(
    env,
    `INSERT INTO posts
       (collection, locale, slug, title, description_raw, description_text, content, content_format,
        excerpt, cover_image, status, published_at, author_id, reading_time, is_featured, tags,
        category_id, scheduled_at, seo_title, og_image)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.collection, body.locale, body.slug, body.title,
      description_raw, body.description_text, body.content, body.content_format ?? 'mdx',
      body.excerpt ?? null, body.cover_image ?? null, initialStatus,
      publishedAt, null, body.reading_time ?? null, body.is_featured ? 1 : 0,
      normalizedTags.length > 0 ? JSON.stringify(normalizedTags) : null,
      Number.isFinite(categoryId as number) ? categoryId : null,
      scheduledAt,
      body.seo_title ? String(body.seo_title).slice(0, 200) : null,
      body.og_image ?? body.cover_image ?? null,
    ]
  );

  const newId = result.meta?.last_row_id;

  // Item 5 + 6 — register the tags and the category for the new article.
  if (newId) {
    try {
      await syncPostTags(env, newId, normalizedTags);
    } catch {
      /* best-effort */
    }
    try {
      await syncPostCategoryJoin(env, newId, Number.isFinite(categoryId as number) ? categoryId : null);
    } catch {
      /* best-effort */
    }
  }

  // Auto-translate a newly-created post that goes straight to published.
  // The same "create the missing sibling locales" logic as updatePost.
  let translations: TranslationOutcome[] = [];
  if (body.status === 'published' && body.auto_translate !== false && newId) {
    const created = await queryFirst<Post>(env, `SELECT * FROM posts WHERE id = ?`, [newId]);
    if (created) {
      translations = await autoTranslateSiblings(env, created);
    }
  }

  /*
   * Trigger the Pages rebuild.
   *
   * This path used to do NOTHING here — only updatePost / publishPost /
   * bulkPublish fired the deploy hook. So a BRAND NEW article that was
   * created straight into "published" state (which is exactly what the
   * editor's 发布 button does on a new note) was written to D1 and then
   * never built into the static site. The admin said "发布成功" while the
   * article stayed invisible on the public site until someone else
   * happened to push a commit.
   *
   * The hook fires ONCE for the whole create, which also covers the
   * sibling locales the translation step just created.
   */
  let deployTriggered = false;
  let deployError: string | null = null;
  if (initialStatus === 'published') {
    const deploy = await triggerDeployHook(env);
    deployTriggered = deploy.triggered;
    deployError = deploy.error;
    try {
      await execute(
        env,
        `INSERT INTO admin_logs (user_id, action, resource_type, resource_id, message) VALUES (?, ?, 'post', ?, ?)`,
        [
          user.id,
          deploy.triggered ? 'create_post_deploy_ok' : 'create_post_deploy_failed',
          newId ?? null,
          deploy.triggered ? null : `站点部署失败：${deploy.error ?? '未知错误'}`,
        ]
      );
    } catch {
      /* the log write is best-effort — never block the response */
    }
  }

  return json(
    {
      success: true,
      data: {
        id: newId,
        slug: body.slug,
        status: initialStatus,
        // The admin shows this: "发布成功" must not hide a failed rebuild.
        deploy_triggered: deployTriggered,
        deploy_error: deployError,
        translations,
        translated_count: translations.filter((t) => t.status === 'created').length,
        translation_errors: translations
          .filter((t) => t.status === 'failed')
          .map((t) => ({ locale: t.locale, error: t.error })),
      },
    },
    201
  );
}

async function getPost(request: Request, env: Env, id: number): Promise<Response> {
  // SECURITY: only authenticated users can read a single post (incl. drafts).
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }
  const post = await queryFirst<Post>(env, `SELECT * FROM posts WHERE id = ?`, [id]);
  if (!post) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  }
  return json({ success: true, data: post });
}

async function updatePost(request: Request, env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Body must be JSON' } }, 400);
  }

  const existing = await queryFirst<Post>(env, `SELECT * FROM posts WHERE id = ?`, [id]);
  if (!existing) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  }

  // SECURITY.md #4 #5 — validate slug format + field length caps before UPDATE.
  // Only check fields the client is actually trying to change.
  try {
    if (body.slug !== undefined) validateSlug(body.slug);
    if (body.title !== undefined) validateTitle(body.title);
    if (body.content !== undefined) validateContent(body.content);
    if (body.description_text !== undefined) validateDescriptionText(body.description_text);
  } catch (e: any) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: e?.message || 'Invalid field' } }, 400);
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  const fields: Record<string, string> = {
    title: 'title',
    description_text: 'description_text',
    content: 'content',
    excerpt: 'excerpt',
    cover_image: 'cover_image',
    status: 'status',
    published_at: 'published_at',
    reading_time: 'reading_time',
    tags: 'tags',
    // Item 6 — the article's category.
    category_id: 'category_id',
    // Item 9 — scheduled publishing.
    scheduled_at: 'scheduled_at',
    // Item 13 — independent SEO title and OG image.
    seo_title: 'seo_title',
    og_image: 'og_image',
  };

  // The tags the post ends up with — used to refresh the tag system
  // (item 5) after the row itself has been written.
  let newTags: string[] | null = null;

  for (const [bodyKey, dbColumn] of Object.entries(fields)) {
    if (body[bodyKey] !== undefined) {
      let value: unknown = body[bodyKey];
      if (bodyKey === 'tags' && Array.isArray(value)) {
        // Split joined tags back apart before they are stored, so every
        // tag on the site has a working tag page.
        const knownTags = await listKnownTags(env);
        const normalized = normalizeTags(value, knownTags);
        newTags = normalized;
        value = JSON.stringify(normalized);
      }
      if (bodyKey === 'status' && !['draft', 'published', 'archived'].includes(value as string)) {
        return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid status' } }, 400);
      }
      if (bodyKey === 'scheduled_at') {
        // The editor sends "YYYY-MM-DD HH:mm". SQLite's datetime('now')
        // returns "YYYY-MM-DD HH:mm:ss", so the two have to be comparable.
        const raw = value === null || value === '' ? null : String(value);
        value = raw === null ? null : raw.replace('T', ' ').slice(0, 16).padEnd(19, ':00');
      }
      if (bodyKey === 'seo_title' && value !== null && value !== undefined) {
        value = String(value).slice(0, 200);
      }
      updates.push(`${dbColumn} = ?`);
      params.push(value);
    }
  }

  // A post scheduled for the future must not be published straight away —
  // it stays a draft until the cron trigger reaches its scheduled time.
  const scheduledRaw =
    body.scheduled_at !== undefined ? String(body.scheduled_at ?? '').replace('T', ' ') : null;
  if (scheduledRaw) {
    const scheduledAt = scheduledRaw.slice(0, 16).padEnd(19, ':00');
    const isFuture = scheduledAt > new Date().toISOString().replace('T', ' ').slice(0, 19);
    if (isFuture && body.status === 'published') {
      // `updates` and `params` were pushed in lockstep, so the index of
      // the status assignment is the index of its value.
      const statusIdx = updates.findIndex((u) => u === 'status = ?');
      if (statusIdx >= 0) params[statusIdx] = 'draft';
    }
  }

  if (body.is_featured !== undefined) {
    updates.push('is_featured = ?');
    params.push(body.is_featured ? 1 : 0);
  }

  // A hand-edit of a machine-translated row turns it into Frank's own
  // text, so the "机器翻译" badge must go away. He can still re-translate
  // explicitly via POST /posts/:id/retranslate.
  //
  // The comparison is against the stored value, not just "the field was
  // sent" — the editor's Save button always sends title/content, so a
  // no-op re-save of an untouched machine translation would otherwise
  // silently drop the badge.
  if (
    (body.content !== undefined && body.content !== existing.content) ||
    (body.title !== undefined && body.title !== existing.title) ||
    (body.description_text !== undefined && body.description_text !== existing.description_text)
  ) {
    updates.push('auto_translated = NULL');
  }

  if (body.description_text !== undefined) {
    updates.push('description_raw = ?');
    params.push(buildDescriptionRaw(body.description_text));
  }

  if (updates.length === 0) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'No fields to update' } }, 400);
  }

  updates.push('updated_at = datetime(\'now\')');
  params.push(id);

  // Item 5 + 6 — keep the tag system and the category join in step with
  // the article that was just written. The join tables are refreshed
  // AFTER the row update so the optimistic-lock token stays valid.
  const refreshTaxonomy = async () => {
    if (newTags) {
      try {
        await syncPostTags(env, id, newTags);
      } catch {
        /* the tag system is best-effort — never block the save */
      }
    }
    if (body.category_id !== undefined) {
      try {
        await syncPostCategoryJoin(
          env,
          id,
          body.category_id === null ? null : Number(body.category_id)
        );
      } catch {
        /* best-effort */
      }
    }
  };

  // Phase C1 §27 — Optimistic Lock: if client sent loaded_updated_at, require
  // current row.updated_at to match. If 0 rows changed, another session wrote
  // first → return 409 Conflict so client can warn the user.
  let loadedUpdatedAt: string | null = null;
  if (typeof body.loaded_updated_at === 'string' && body.loaded_updated_at.length > 0) {
    loadedUpdatedAt = body.loaded_updated_at;
    // WHERE id = ? AND updated_at = ?  (current row's updated_at must match)
    const result = await execute(
      env,
      `UPDATE posts SET ${updates.join(', ')} WHERE id = ? AND updated_at = ?`,
      [...params, loadedUpdatedAt]
    );
    if (!result.meta || result.meta.changes === 0) {
      // Fetch fresh updated_at so client can decide whether to reload.
      const fresh = await queryFirst<{ updated_at: string }>(
        env,
        `SELECT updated_at FROM posts WHERE id = ?`,
        [id]
      );
      return json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'This post was modified in another session. Your version may overwrite newer changes.',
            current_updated_at: fresh?.updated_at ?? null,
          },
        },
        409
      );
    }
    // Phase 11e — successful update writes a revision so the post-revision
    // drawer has something to display. Without this, the drawer stays
    // empty forever (autosave uses saveDraft which deliberately skips
    // revisions to avoid 1-revision-per-keystroke noise; explicit Save
    // Draft and Publish are the right granularity). We re-SELECT after the
    // UPDATE so the revision captures the post-update state (locale/status
    // may have changed in this call).
    const fresh = await queryFirst<Post>(env, `SELECT * FROM posts WHERE id = ?`, [id]);
    if (fresh) {
      try {
        await createRevision(env, fresh, user.id);
      } catch {
        /* revision history is best-effort — never block the save */
      }
    }
    await refreshTaxonomy();

    // Phase 11f — If the post is already published and we just edited its
    // body / title / etc. (without changing status), the MDX files out
    // there are now stale. Trigger the Pages rebuild so visitors see the
    // edit on the next deploy cycle. We only do this for published posts
    // — editing a draft doesn't need a rebuild since it's not on the
    // public site. The deploy hook is fire-and-forget; a failure logs
    // to admin_logs but doesn't fail the PUT.
    if (existing.status === 'published' || body.status === 'published') {
      // Auto-translation: when a post transitions INTO published, generate
      // the sibling locales. `existing.status !== 'published'` is the
      // "just published" signal — an edit to an already-published post
      // must NOT re-translate, because the sibling may have been
      // hand-edited since.
      const justPublished = existing.status !== 'published' && body.status === 'published';
      let translations: TranslationOutcome[] = [];
      if (justPublished && fresh && body.auto_translate !== false) {
        translations = await autoTranslateSiblings(env, fresh);
      }

      const deploy = await triggerDeployHook(env);
      try {
        await execute(
          env,
          `INSERT INTO admin_logs (user_id, action, resource_type, resource_id, message) VALUES (?, ?, 'post', ?, ?)`,
          [
            user.id,
            deploy.triggered ? 'update_post_deploy_ok' : 'update_post_deploy_failed',
            id,
            // Item 15 — a failed deploy has to say WHY it failed.
            deploy.triggered ? null : `站点部署失败：${deploy.error ?? '未知错误'}`,
          ]
        );
      } catch {
        /* log is best-effort */
      }
      const translationErrors = translations
        .filter((t) => t.status === 'failed')
        .map((t) => ({ locale: t.locale, error: t.error }));
      if (!deploy.triggered) {
        return json(
          {
            success: true,
            data: {
              id,
              updated: true,
              updated_at: loadedUpdatedAt,
              deploy_triggered: false,
              deploy_error: deploy.error,
              translations,
              translated_count: translations.filter((t) => t.status === 'created').length,
              translation_errors: translationErrors,
            },
          },
          200
        );
      }
      return json({
        success: true,
        data: {
          id,
          updated: true,
          updated_at: loadedUpdatedAt,
          deploy_triggered: true,
          deploy_error: null,
          translations,
          translated_count: translations.filter((t) => t.status === 'created').length,
          translation_errors: translationErrors,
        },
      });
    }

    return json({ success: true, data: { id, updated: true, updated_at: loadedUpdatedAt } });
  }

  await execute(env, `UPDATE posts SET ${updates.join(', ')} WHERE id = ?`, params);
  // See optimistic-lock branch above for why we write a revision here.
  const fresh = await queryFirst<Post>(env, `SELECT * FROM posts WHERE id = ?`, [id]);
  if (fresh) {
    try {
      await createRevision(env, fresh, user.id);
    } catch {
      /* revision history is best-effort — never block the save */
    }
  }
  await refreshTaxonomy();

  // Phase 11f — same deploy-on-edit rationale as above. This branch runs
  // when the client didn't send loaded_updated_at (the optimistic-lock
  // path is skipped). Same trigger condition.
  if (existing.status === 'published' || body.status === 'published') {
    const justPublished = existing.status !== 'published' && body.status === 'published';
    let translations: TranslationOutcome[] = [];
    if (justPublished && fresh && body.auto_translate !== false) {
      translations = await autoTranslateSiblings(env, fresh);
    }
    const deploy = await triggerDeployHook(env);
    try {
      await execute(
        env,
        `INSERT INTO admin_logs (user_id, action, resource_type, resource_id, message) VALUES (?, ?, 'post', ?, ?)`,
        [
          user.id,
          deploy.triggered ? 'update_post_deploy_ok' : 'update_post_deploy_failed',
          id,
          // Item 15 — a failed deploy has to say WHY it failed.
          deploy.triggered ? null : `站点部署失败：${deploy.error ?? '未知错误'}`,
        ]
      );
    } catch {
      /* log is best-effort */
    }
    return json({
      success: true,
      data: {
        id,
        updated: true,
        // The rebuild result — the admin tells the user whether the
        // article is live on the site or only in the database.
        deploy_triggered: deploy.triggered,
        deploy_error: deploy.error,
        translations,
        translated_count: translations.filter((t) => t.status === 'created').length,
        translation_errors: translations
          .filter((t) => t.status === 'failed')
          .map((t) => ({ locale: t.locale, error: t.error })),
      },
    });
  }

  return json({ success: true, data: { id, updated: true } });
}

async function deletePost(request: Request, env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  // SECURITY — this handler never checked the session. The CSRF check is
  // a double-submit check (header vs cookie), which a caller can forge,
  // so ANYBODY could delete an article from the live site. Every other
  // write path checks the session; this one did not.
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }

  const post = await queryFirst<{ id: number; title: string }>(
    env,
    `SELECT id, title FROM posts WHERE id = ?`,
    [id]
  );
  if (!post) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);
  }

  await execute(env, `DELETE FROM posts WHERE id = ?`, [id]);

  // The site is a static build: a deleted article stays on the public
  // site until the next rebuild. This path used to skip the deploy
  // hook, so a deleted article kept showing up on the front end.
  const deploy = await triggerDeployHook(env);

  try {
    await execute(
      env,
      `INSERT INTO admin_logs (user_id, action, resource_type, resource_id, message) VALUES (?, ?, 'post', ?, ?)`,
      [
        user.id,
        deploy.triggered ? 'delete_post_deploy_ok' : 'delete_post_deploy_failed',
        id,
        deploy.triggered
          ? `删除文章：${post.title}`
          : `删除文章：${post.title}（站点部署失败：${deploy.error ?? '未知错误'}）`,
      ]
    );
  } catch {
    /* the log write is best-effort */
  }

  return json({
    success: true,
    data: {
      id,
      deleted: true,
      deploy_triggered: deploy.triggered,
      deploy_error: deploy.error,
    },
  });
}

// ────────────────────────────────────────────────────
// /api/admin/posts/:id/publish + /unpublish
// ────────────────────────────────────────────────────

async function publishPost(request: Request, env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }

  const post = await queryFirst<Post>(env, `SELECT * FROM posts WHERE id = ?`, [id]);
  if (!post) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  }

  // Optional body: { auto_translate?: boolean }
  // Default is ON — Frank's whole point of this feature is that he writes
  // one language and the other two follow. He can turn it off per publish
  // if he ever wants to publish a single-locale version on purpose.
  let autoTranslate = true;
  try {
    const raw = await request.text();
    if (raw.trim()) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.auto_translate === 'boolean') {
        autoTranslate = parsed.auto_translate;
      }
    }
  } catch {
    // A malformed body means "no options" — keep the default.
  }

  const now = new Date().toISOString();
  await execute(
    env,
    `UPDATE posts SET status = 'published', published_at = ?, updated_at = datetime('now') WHERE id = ?`,
    [now, id]
  );

  // Refresh the row so the translation sees the just-published state.
  const published = await queryFirst<Post>(env, `SELECT * FROM posts WHERE id = ?`, [id]);

  // Auto-translate into the sibling locales. A failure here must NOT
  // block the publish of the source article — the Chinese version is
  // already live at this point.
  let translations: TranslationOutcome[] = [];
  if (autoTranslate && published) {
    translations = await autoTranslateSiblings(env, published);
  }

  const deploy = await triggerDeployHook(env);

  await execute(
    env,
    `INSERT INTO admin_logs (user_id, action, resource_type, resource_id) VALUES (?, ?, ?, ?)`,
    [null, deploy.triggered ? 'publish_post' : 'publish_post_failed', 'post', id]
  );

  const translatedOk = translations.filter((t) => t.status === 'created').length;
  const translatedFailed = translations.filter((t) => t.status === 'failed');

  return json(
    {
      success: deploy.triggered,
      data: {
        id,
        status: 'published',
        published_at: now,
        deploy_triggered: deploy.triggered,
        deploy_error: deploy.error,
        deploy_ts: deploy.ts,
        auto_translate: autoTranslate,
        translations,
        // Convenience summary for the admin UI toast.
        translated_count: translatedOk,
        translation_errors: translatedFailed.map((t) => ({
          locale: t.locale,
          error: t.error,
        })),
      },
      ...(deploy.triggered
        ? {}
        : { error: { code: 'DEPLOY_HOOK_FAILED', message: deploy.error || 'Deploy hook failed' } }),
    },
    deploy.triggered ? 200 : 502
  );
}

/**
 * POST /api/admin/posts/:id/retranslate
 *
 * Re-runs the machine translation for a specific target locale and
 * overwrites that locale's row. This is the explicit escape hatch for the
 * "auto-translation never overwrites an existing sibling" rule: Frank
 * asks for it, so it happens.
 *
 * Body: { locale: 'ja' | 'en', force?: boolean }
 */
async function retranslatePost(request: Request, env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }

  let body: { locale?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Body must be JSON' } }, 400);
  }

  const locale = typeof body.locale === 'string' ? body.locale : '';
  if (!['ja', 'en', 'zh'].includes(locale)) {
    return json(
      { success: false, error: { code: 'INVALID_REQUEST', message: 'locale must be zh/ja/en' } },
      400
    );
  }

  const post = await queryFirst<Post>(env, `SELECT * FROM posts WHERE id = ?`, [id]);
  if (!post) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  }
  if (post.locale === locale) {
    return json(
      { success: false, error: { code: 'INVALID_REQUEST', message: 'Cannot translate a post into its own locale' } },
      400
    );
  }

  const outcomes = await autoTranslateSiblings(env, post, { force: true });
  const outcome = outcomes.find((o) => o.locale === locale);

  if (!outcome || outcome.status === 'failed') {
    return json(
      {
        success: false,
        error: {
          code: 'TRANSLATION_FAILED',
          message: outcome?.error || 'Translation failed',
        },
      },
      502
    );
  }

  const deploy = await triggerDeployHook(env);

  return json({
    success: true,
    data: {
      id,
      locale,
      translation: outcome,
      deploy_triggered: deploy.triggered,
      deploy_error: deploy.error,
    },
  });
}

// ────────────────────────────────────────────────────
// /api/admin/posts/bulk-publish — Phase 11b
// Publish many drafts in one request and trigger the deploy hook exactly
// once. Without this, looping client-side over /:id/publish would trigger
// the Pages rebuild hook N times — turning a 30-second bulk action into
// a multi-minute queue of N independent rebuilds.
//
// Behaviour:
//   - Accepts { ids: number[] } (max 100 to prevent runaway payloads).
//   - Uses D1's db.batch() to UPDATE every row + insert one admin_log row
//     per id in a single network round-trip.
//   - Triggers the deploy hook ONCE at the end, regardless of how many
//     posts were actually flipped to 'published'.
//   - Per-id skip reasons (not found / already published) are reported
//     individually so the UI can show "5 of 7 succeeded".
// ────────────────────────────────────────────────────────────

const BULK_PUBLISH_MAX = 100;

async function bulkPublishPosts(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Body must be JSON' } }, 400);
  }

  const rawIds = body?.ids;
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'ids must be a non-empty array' } }, 400);
  }
  if (rawIds.length > BULK_PUBLISH_MAX) {
    return json(
      { success: false, error: { code: 'INVALID_REQUEST', message: `Cannot publish more than ${BULK_PUBLISH_MAX} posts at once` } },
      400
    );
  }

  // Sanitize: keep only positive integers, dedupe.
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const v of rawIds) {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    if (Number.isFinite(n) && n > 0 && !seen.has(n)) {
      seen.add(n);
      ids.push(n);
    }
  }
  if (ids.length === 0) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'No valid post ids in request' } }, 400);
  }

  const now = new Date().toISOString();

  // Look up which ids actually exist + their current status. We only flip
  // rows that are still 'draft' or 'archived' — re-publishing an
  // already-published post would update published_at and surprise the user.
  const placeholders = ids.map(() => '?').join(',');
  const existing = await queryAll<{ id: number; status: string }>(
    env,
    `SELECT id, status FROM posts WHERE id IN (${placeholders})`,
    ids
  );
  const existingMap = new Map(existing.map((p) => [p.id, p.status]));

  const toPublish = ids.filter((id) => {
    const s = existingMap.get(id);
    return s === 'draft' || s === 'archived';
  });
  const skipped = ids.filter((id) => !existingMap.has(id) || existingMap.get(id) === 'published');

  // Build batch statements. db.batch runs them sequentially within a
  // single D1 RPC but doesn't wrap them in a transaction — D1 has no
  // user-visible BEGIN/COMMIT. We accept that: if the batch fails
  // partway, the worst case is some posts got flipped and some didn't,
  // which is recoverable (UI re-renders shows updated states).
  const db = getDB(env);
  const statements: D1PreparedStatement[] = [];
  for (const id of toPublish) {
    statements.push(
      db.prepare(
        `UPDATE posts SET status = 'published', published_at = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(now, id)
    );
  }
  for (const id of toPublish) {
    statements.push(
      db.prepare(
        `INSERT INTO admin_logs (user_id, action, resource_type, resource_id) VALUES (?, 'publish_post', 'post', ?)`
      ).bind(user.id, id)
    );
  }

  let batchError: string | null = null;
  if (statements.length > 0) {
    try {
      await db.batch(statements);
    } catch (e: any) {
      batchError = e?.message || 'Batch update failed';
    }
  }

  // Trigger the deploy hook exactly once — only if we actually flipped
  // any rows. This is the whole point of this endpoint vs looping
  // client-side: a 50-post bulk publish triggers ONE Pages rebuild,
  // not 50.
  let deployTriggered = false;
  let deployError: string | null = null;
  if (!batchError && toPublish.length > 0) {
    const deploy = await triggerDeployHook(env);
    deployTriggered = deploy.triggered;
    deployError = deploy.error;
    // Best-effort log the deploy outcome — separate from the per-post
    // logs above so we don't lose visibility if it failed.
    try {
      await execute(
        env,
        `INSERT INTO admin_logs (user_id, action, resource_type, resource_id) VALUES (?, ?, 'bulk', ?)`,
        [
          user.id,
          deployTriggered ? 'bulk_publish_deploy_ok' : 'bulk_publish_deploy_failed',
          toPublish.length,
        ]
      );
    } catch {
      /* log write is best-effort, never block the response */
    }
  }

  return json({
    success: !batchError && deployTriggered,
    data: {
      requested: ids.length,
      published: toPublish.length,
      skipped: skipped.length,
      skip_reasons: Object.fromEntries(
        skipped.map((id) => [
          String(id),
          existingMap.has(id) ? 'already_published' : 'not_found',
        ])
      ),
      published_at: now,
      deploy_triggered: deployTriggered,
      deploy_error: deployError,
      ...(batchError ? { batch_error: batchError } : {}),
    },
  }, batchError ? 500 : (deployTriggered ? 200 : 502));
}

async function unpublishPost(request: Request, env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  // SECURITY — this handler never checked the session either, so an
  // unauthenticated caller could take any published article down.
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }

  const post = await queryFirst<{ id: number }>(env, `SELECT id FROM posts WHERE id = ?`, [id]);
  if (!post) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);
  }

  await execute(
    env,
    `UPDATE posts SET status = 'draft', published_at = NULL, updated_at = datetime('now') WHERE id = ?`,
    [id]
  );

  const deploy = await triggerDeployHook(env);

  await execute(
    env,
    `INSERT INTO admin_logs (user_id, action, resource_type, resource_id, message) VALUES (?, ?, 'post', ?, ?)`,
    [
      user.id,
      deploy.triggered ? 'unpublish_post' : 'unpublish_post_failed',
      id,
      deploy.triggered ? null : `取消发布失败：${deploy.error ?? '未知错误'}`,
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
}

// ────────────────────────────────────────────────────
// /api/admin/preview/:id
// ────────────────────────────────────────────────────

async function previewPost(request: Request, env: Env, id: number): Promise<Response> {
  // SECURITY: only authenticated users can preview posts.
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  const post = await queryFirst<any>(
    env,
    `SELECT id, collection, locale, slug, title, description_text, description_raw,
            content, excerpt, cover_image, status, is_featured, tags,
            published_at, updated_at, reading_time, author_id
     FROM posts WHERE id = ?`,
    [id]
  );
  if (!post) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  }
  return json({ success: true, data: post });
}

// ────────────────────────────────────────────────────
// CORS
// ────────────────────────────────────────────────────

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}
