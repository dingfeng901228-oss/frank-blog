// worker-api/src/index.ts
// frank-blog CMS API Worker — single entry, manual router
// Handles all /api/admin/* routes that used to live in functions/api/admin/
// (Pages Functions couldn't apply [[d1_databases]] to deployment; Worker can.)

import type { Env, User, Post, MediaRecord, CategoryRecord, TagRecord, PostCollection, ActivityEntry, PostRevision } from './cms';
import {
  queryFirst,
  queryAll,
  execute,
  verifyPassword,
  createSession,
  getSessionUser,
  deleteSession,
  triggerDeployHook,
  json,
  parseCookies,
  sha256Hex,
  hashIp,
  publicUser,
  buildSessionCookie,
  buildClearCookie,
  buildDescriptionRaw,
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
  createTag,
  updateTag,
  deleteTag,
  listRecentActivity,
  listRevisions,
  restoreRevision,
} from './cms';

const SESSION_TTL_DAYS = 7;

// ────────────────────────────────────────────────────
// Default export — Worker entry point
// ────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, _ctx: any): Promise<Response> {
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

    // /api/admin/auth/*
    if (path === '/api/admin/auth/login' && method === 'POST') return login(request, env);
    if (path === '/api/admin/auth/logout' && method === 'POST') return logout(request, env);
    if (path === '/api/admin/auth/me' && method === 'GET') return me(request, env);

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
      if (method === 'DELETE') return deletePost(request, env, id);
    }

    // /api/admin/posts/:id/publish
    m = path.match(/^\/api\/admin\/posts\/(\d+)\/publish$/);
    if (m && method === 'POST') return publishPost(request, env, parseInt(m[1], 10));

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

    // /api/admin/posts/:id/revisions + restore (Phase 6)
    m = path.match(/^\/api\/admin\/posts\/(\d+)\/revisions$/);
    if (m && method === 'GET') return listRevisionsHandler(request, env, parseInt(m[1], 10));
    m = path.match(/^\/api\/admin\/posts\/(\d+)\/revisions\/(\d+)\/restore$/);
    if (m && method === 'POST') return restoreRevisionHandler(request, env, parseInt(m[2], 10));

    return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
  },
};

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

  await execute(env, `UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, [user.id]);
  await execute(
    env,
    `INSERT INTO admin_logs (user_id, action, ip_hash) VALUES (?, 'login', ?)`,
    [user.id, ipHash]
  );

  return new Response(
    JSON.stringify({
      success: true,
      data: { user: publicUser(user), expires_at: expiresAt },
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildSessionCookie(token, expiresAt),
      },
    }
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

  return new Response(
    JSON.stringify({ success: true, data: { logged_out: true } }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': buildClearCookie(),
      },
    }
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

// ────────────────────────────────────────────────────
// /api/admin/media handlers (Phase 4 — Media Library)
// ────────────────────────────────────────────────────

async function getCurrentUser(request: Request, env: Env): Promise<User | null> {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (!sessionToken) return null;
  const tokenHash = await sha256Hex(sessionToken);
  return getSessionUser(env, tokenHash);
}

async function listMediaHandler(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const search = url.searchParams.get('search') ?? undefined;
  const result = await listMedia(env, { limit, offset, search });
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
  const items = await listTags(env);
  return json({ success: true, data: { items } });
}

async function createTagHandler(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  try {
    const body = await request.json() as { name?: string; slug?: string };
    if (!body.name || !body.slug) {
      return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'name, slug required' } }, 400);
    }
    const tag = await createTag(env, body.name, body.slug);
    return json({ success: true, data: tag }, 201);
  } catch (e: any) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: e?.message || 'Create failed' } }, 400);
  }
}

async function updateTagHandler(request: Request, env: Env, id: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  try {
    const body = await request.json() as { name?: string; slug?: string };
    if (!body.name || !body.slug) {
      return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'name, slug required' } }, 400);
    }
    await updateTag(env, id, body.name, body.slug);
    return json({ success: true });
  } catch (e: any) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: e?.message || 'Update failed' } }, 400);
  }
}

async function deleteTagHandler(request: Request, env: Env, id: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  try {
    await deleteTag(env, id);
    return new Response(null, { status: 204 });
  } catch (e: any) {
    const msg = e?.message || 'Delete failed';
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
    return json({ success: true });
  } catch (e: any) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: e?.message || 'Restore failed' } }, 404);
  }
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

async function listPosts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const locale = url.searchParams.get('locale');
  const status = url.searchParams.get('status');
  const collection = url.searchParams.get('collection');
  const search = url.searchParams.get('search');
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)));
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const params: unknown[] = [];

  if (locale) { where.push('locale = ?'); params.push(locale); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (collection) { where.push('collection = ?'); params.push(collection); }
  if (search) {
    where.push('(title LIKE ? OR slug LIKE ?)');
    const wildcard = `%${search}%`;
    params.push(wildcard, wildcard);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const totalRow = await queryFirst<{ n: number }>(
    env,
    `SELECT COUNT(*) as n FROM posts ${whereClause}`,
    params
  );
  const total = totalRow?.n ?? 0;

  const posts = await queryAll<Post>(
    env,
    `SELECT id, collection, locale, slug, title, status, published_at, updated_at, created_at, cover_image, is_featured
     FROM posts
     ${whereClause}
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return json({
    success: true,
    data: { posts, total, page, limit, has_more: offset + posts.length < total },
  });
}

async function createPost(request: Request, env: Env): Promise<Response> {
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
  const publishedAt = body.published_at ?? new Date().toISOString().split('T')[0];

  const result = await execute(
    env,
    `INSERT INTO posts
       (collection, locale, slug, title, description_raw, description_text, content, content_format,
        excerpt, cover_image, status, published_at, author_id, reading_time, is_featured, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.collection, body.locale, body.slug, body.title,
      description_raw, body.description_text, body.content, body.content_format ?? 'mdx',
      body.excerpt ?? null, body.cover_image ?? null, body.status ?? 'draft',
      publishedAt, null, body.reading_time ?? null, body.is_featured ? 1 : 0,
      body.tags ? JSON.stringify(body.tags) : null,
    ]
  );

  return json(
    {
      success: true,
      data: {
        id: result.meta?.last_row_id,
        slug: body.slug,
        status: body.status ?? 'draft',
      },
    },
    201
  );
}

async function getPost(_request: Request, env: Env, id: number): Promise<Response> {
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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Body must be JSON' } }, 400);
  }

  const existing = await queryFirst<Post>(env, `SELECT id FROM posts WHERE id = ?`, [id]);
  if (!existing) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
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
  };

  for (const [bodyKey, dbColumn] of Object.entries(fields)) {
    if (body[bodyKey] !== undefined) {
      let value: unknown = body[bodyKey];
      if (bodyKey === 'tags' && Array.isArray(value)) {
        value = JSON.stringify(value);
      }
      if (bodyKey === 'status' && !['draft', 'published', 'archived'].includes(value as string)) {
        return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid status' } }, 400);
      }
      updates.push(`${dbColumn} = ?`);
      params.push(value);
    }
  }

  if (body.is_featured !== undefined) {
    updates.push('is_featured = ?');
    params.push(body.is_featured ? 1 : 0);
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

  await execute(env, `UPDATE posts SET ${updates.join(', ')} WHERE id = ?`, params);

  return json({ success: true, data: { id, updated: true } });
}

async function deletePost(_request: Request, env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }
  await execute(env, `DELETE FROM posts WHERE id = ?`, [id]);
  return new Response(null, { status: 204 });
}

// ────────────────────────────────────────────────────
// /api/admin/posts/:id/publish + /unpublish
// ────────────────────────────────────────────────────

async function publishPost(request: Request, env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  const post = await queryFirst<{ id: number }>(env, `SELECT id FROM posts WHERE id = ?`, [id]);
  if (!post) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  }

  const now = new Date().toISOString();
  await execute(
    env,
    `UPDATE posts SET status = 'published', published_at = ?, updated_at = datetime('now') WHERE id = ?`,
    [now, id]
  );

  const deploy = await triggerDeployHook(env);

  await execute(
    env,
    `INSERT INTO admin_logs (user_id, action, resource_type, resource_id) VALUES (?, ?, ?, ?)`,
    [null, deploy.triggered ? 'publish_post' : 'publish_post_failed', 'post', id]
  );

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
      },
      ...(deploy.triggered
        ? {}
        : { error: { code: 'DEPLOY_HOOK_FAILED', message: deploy.error || 'Deploy hook failed' } }),
    },
    deploy.triggered ? 200 : 502
  );
}

async function unpublishPost(request: Request, env: Env, id: number): Promise<Response> {
  if (!Number.isFinite(id)) {
    return json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Invalid post id' } }, 400);
  }

  const post = await queryFirst<{ id: number }>(env, `SELECT id FROM posts WHERE id = ?`, [id]);
  if (!post) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: 'Post not found' } }, 404);
  }

  await execute(
    env,
    `UPDATE posts SET status = 'draft', published_at = NULL, updated_at = datetime('now') WHERE id = ?`,
    [id]
  );

  const deploy = await triggerDeployHook(env);

  await execute(
    env,
    `INSERT INTO admin_logs (user_id, action, resource_type, resource_id) VALUES (?, ?, ?, ?)`,
    [null, deploy.triggered ? 'unpublish_post' : 'unpublish_post_failed', 'post', id]
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

async function previewPost(_request: Request, env: Env, id: number): Promise<Response> {
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
