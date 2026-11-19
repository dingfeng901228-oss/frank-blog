// worker-api/src/admin-ext.ts
// Admin CMS — the endpoints that back the taxonomy, bulk, export,
// settings, activity-detail and scheduled-publishing features.
//
// Kept in its own module so index.ts stays a readable router.
// Every handler returns the same envelope the admin SPA expects:
//   { success: true, data: ... }  |  { success: false, error: { code, message } }

import {
  queryAll,
  queryFirst,
  execute,
  getCurrentUser,
  triggerDeployHook,
  json,
  escapeLike,
} from './cms';
import type { Env } from './cms';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

function badRequest(message: string): Response {
  return json({ success: false, error: { code: 'INVALID_REQUEST', message } }, 400);
}

/**
 * POST /api/admin/posts/bulk
 *
 * One endpoint for every bulk action the list page offers:
 *   publish | archive | delete | move_category
 *
 * `ids` is the list of selected post ids. Every id is reported back
 * individually so the UI can say exactly what happened to what.
 */
export async function handleBulk(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求格式错误');
  }

  const ids: number[] = Array.isArray(body.ids)
    ? body.ids.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
    : [];
  const action = String(body.action || '');

  if (ids.length === 0) return badRequest('没有选中任何文章');
  if (ids.length > 500) return badRequest('一次最多处理 500 篇');
  if (!['publish', 'archive', 'delete', 'move_category'].includes(action)) {
    return badRequest('未知的批量操作');
  }

  const placeholders = ids.map(() => '?').join(',');
  const rows = await queryAll<{ id: number; status: string; slug: string; title: string }>(
    env,
    `SELECT id, status, slug, title FROM posts WHERE id IN (${placeholders})`,
    ids
  );
  const found = new Map(rows.map((r) => [r.id, r]));

  const done: number[] = [];
  const skipped: Array<{ id: number; reason: string }> = [];
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  for (const id of ids) {
    const row = found.get(id);
    if (!row) {
      skipped.push({ id, reason: 'not_found' });
      continue;
    }
    try {
      if (action === 'delete') {
        await execute(env, `DELETE FROM posts WHERE id = ?`, [id]);
      } else if (action === 'archive') {
        await execute(env, `UPDATE posts SET status = 'archived', updated_at = datetime('now') WHERE id = ?`, [id]);
      } else if (action === 'publish') {
        if (row.status === 'published') {
          skipped.push({ id, reason: 'already_published' });
          continue;
        }
        await execute(
          env,
          `UPDATE posts SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = datetime('now') WHERE id = ?`,
          [now, id]
        );
      } else if (action === 'move_category') {
        const categoryId = body.category_id === null ? null : Number(body.category_id);
        if (categoryId !== null && !Number.isFinite(categoryId)) {
          return badRequest('分类 ID 无效');
        }
        await execute(env, `UPDATE posts SET category_id = ?, updated_at = datetime('now') WHERE id = ?`, [
          categoryId,
          id,
        ]);
        await execute(env, `DELETE FROM post_category WHERE post_id = ?`, [id]);
        if (categoryId !== null) {
          await execute(env, `INSERT OR REPLACE INTO post_category (post_id, category_id) VALUES (?, ?)`, [
            id,
            categoryId,
          ]);
        }
      }
      done.push(id);
    } catch {
      skipped.push({ id, reason: 'failed' });
    }
  }

  // Publishing changes the public site, so it needs a rebuild.
  let deploy_triggered = false;
  let deploy_error: string | null = null;
  // Every action here changes what the public site shows:
  //   publish  → the article goes live
  //   archive  → the article disappears from the site
  //   delete   → the article disappears from the site
  // The site is a static build, so all of them need a rebuild. This
  // path used to rebuild ONLY for publish, which meant an archived or
  // deleted article kept showing up on the front end.
  const needsDeploy = action === 'publish' || action === 'archive' || action === 'delete';
  if (needsDeploy && done.length > 0) {
    const deploy = await triggerDeployHook(env);
    deploy_triggered = deploy.triggered;
    deploy_error = deploy.error;
    await execute(
      env,
      `INSERT INTO admin_logs (user_id, action, resource_type, resource_id, message) VALUES (?, ?, 'post', ?, ?)`,
      [
        user.id,
        deploy.triggered
          ? `bulk_${action}_deploy_ok`
          : `bulk_${action}_deploy_failed`,
        done[0] ?? null,
        deploy.triggered
          ? `批量${action === 'publish' ? '发布' : action === 'archive' ? '归档' : '删除'} ${done.length} 篇`
          : `批量${action === 'publish' ? '发布' : action === 'archive' ? '归档' : '删除'} ${done.length} 篇：站点部署失败（${deploy.error ?? '未知错误'}）`,
      ]
    );
  } else if (action === 'delete' && done.length > 0) {
    await execute(
      env,
      `INSERT INTO admin_logs (user_id, action, resource_type, resource_id, message) VALUES (?, 'bulk_delete', 'post', ?, ?)`,
      [user.id, done[0] ?? null, `批量删除 ${done.length} 篇`]
    );
  }

  return json({
    success: true,
    data: {
      action,
      done: done.length,
      ids: done,
      skipped,
      deploy_triggered,
      deploy_error,
    },
  });
}

/**
 * GET /api/admin/export?format=json|markdown
 *
 * Everything the CMS owns: posts (all locales), tags and categories.
 * The admin's "导出全部数据" button downloads this.
 */
export async function handleExport(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }

  const url = new URL(request.url);
  const format = (url.searchParams.get('format') || 'json').toLowerCase();
  const collection = url.searchParams.get('collection');

  const where = collection && ['posts', 'notes'].includes(collection) ? 'WHERE collection = ?' : '';
  const params = where ? [collection] : [];

  const posts = await queryAll<any>(
    env,
    `SELECT id, collection, locale, slug, title, description_text, content, tags, status,
            published_at, updated_at, created_at, cover_image, category_id, reading_time,
            is_featured, auto_translated, seo_title, og_image, scheduled_at
     FROM posts ${where}
     ORDER BY collection, slug, locale`,
    params
  );
  const tags = await queryAll<any>(env, `SELECT id, name, slug, created_at FROM tags ORDER BY name`);
  const categories = await queryAll<any>(
    env,
    `SELECT id, name, slug, collection, created_at FROM categories ORDER BY collection, name`
  );

  if (format === 'markdown') {
    const lines: string[] = [];
    lines.push('# Frank Ding 博客导出');
    lines.push('');
    lines.push(`导出时间：${new Date().toISOString().replace('T', ' ').slice(0, 19)}`);
    lines.push('');
    lines.push('## 分类');
    for (const c of categories) lines.push(`- ${c.name}（${c.collection}，/${c.slug}）`);
    lines.push('');
    lines.push('## 标签');
    lines.push(tags.map((t) => `- ${t.name}`).join('\n'));
    lines.push('');
    lines.push('## 文章');
    for (const p of posts) {
      lines.push('');
      lines.push(`### ${p.title}`);
      lines.push('');
      lines.push(`- 集合：${p.collection}`);
      lines.push(`- 语言：${p.locale}`);
      lines.push(`- slug：${p.slug}`);
      lines.push(`- 状态：${p.status}`);
      lines.push(`- 发布时间：${p.published_at ?? '—'}`);
      lines.push(`- 标签：${safeTags(p.tags).join('、') || '—'}`);
      lines.push('');
      lines.push(p.description_text || '');
      lines.push('');
      lines.push(p.content || '');
    }
    const md = lines.join('\n');
    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="frank-blog-export.md"',
      },
    });
  }

  return json({
    success: true,
    data: {
      exported_at: new Date().toISOString(),
      counts: { posts: posts.length, tags: tags.length, categories: categories.length },
      posts,
      tags,
      categories,
    },
  });
}

function safeTags(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(String(raw));
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * GET /api/admin/settings
 * PUT /api/admin/settings   { key, value }  (or { settings: { k: v } })
 *
 * The site-level settings: title, description, default language, timezone.
 */
export async function handleSettings(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }

  if (request.method === 'GET') {
    const rows = await queryAll<{ key: string; value: string; updated_at: string }>(
      env,
      `SELECT key, value, updated_at FROM settings ORDER BY key`
    );
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    return json({ success: true, data: { settings } });
  }

  if (request.method === 'PUT') {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return badRequest('请求格式错误');
    }
    const incoming: Record<string, string> =
      body && typeof body.settings === 'object' && body.settings !== null
        ? body.settings
        : body && typeof body.key === 'string'
          ? { [body.key]: String(body.value ?? '') }
          : {};
    const entries = Object.entries(incoming);
    if (entries.length === 0) return badRequest('没有要保存的设置项');

    for (const [key, value] of entries) {
      if (!/^[a-z0-9_.-]{1,64}$/i.test(key)) return badRequest(`设置项名称无效：${key}`);
      if (String(value).length > 2000) return badRequest(`设置项过长：${key}`);
      await execute(
        env,
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
        [key, String(value)]
      );
    }
    return json({ success: true, data: { saved: entries.length } });
  }

  return badRequest('不支持的方法');
}

/**
 * GET /api/admin/activity
 *
 * The activity log with the filters the admin page needs: an action
 * filter, a free-text search and a date range.
 *
 * GET /api/admin/activity/:id  — one entry with its message, used by
 * the "查看详情" panel.
 */
export async function handleActivity(request: Request, env: Env, id?: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }

  if (id !== undefined) {
    const row = await queryFirst<any>(env, `SELECT * FROM admin_logs WHERE id = ?`, [id]);
    if (!row) {
      return json({ success: false, error: { code: 'NOT_FOUND', message: '记录不存在' } }, 404);
    }
    let post: any = null;
    if (row.resource_type === 'post' && row.resource_id) {
      post = await queryFirst<any>(
        env,
        `SELECT id, collection, locale, slug, title, status FROM posts WHERE id = ?`,
        [row.resource_id]
      );
    }
    return json({ success: true, data: { entry: row, post } });
  }

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
  const action = url.searchParams.get('action') || '';
  const q = (url.searchParams.get('q') || '').trim();
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';

  const where: string[] = [];
  const params: unknown[] = [];
  if (action) {
    if (action === 'failed') {
      where.push(`al.action LIKE '%failed%'`);
    } else if (action === 'deploy') {
      where.push(`al.action LIKE '%deploy%'`);
    } else {
      where.push('al.action = ?');
      params.push(action);
    }
  }
  if (from) {
    where.push('al.created_at >= ?');
    params.push(from);
  }
  if (to) {
    where.push('al.created_at <= ?');
    params.push(to.length === 10 ? `${to} 23:59:59` : to);
  }
  if (q) {
    // instr() instead of LIKE — a literal substring search.
    where.push('(instr(al.action, ?) > 0 OR instr(al.message, ?) > 0 OR instr(u.username, ?) > 0)');
    params.push(q, q, q);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const items = await queryAll<any>(
    env,
    `SELECT al.id, al.user_id, u.username, al.action, al.resource_type, al.resource_id,
            al.message, al.created_at
     FROM admin_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereClause}
     ORDER BY al.id DESC
     LIMIT ?`,
    [...params, limit]
  );

  return json({ success: true, data: { items } });
}

/**
 * POST /api/admin/posts/:id/redeploy
 *
 * Re-runs the Pages deploy hook. The activity log's "重试" button for a
 * failed deploy calls this.
 */
export async function handleRedeploy(request: Request, env: Env, id: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  const post = await queryFirst<any>(env, `SELECT id, title FROM posts WHERE id = ?`, [id]);
  if (!post) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: '文章不存在' } }, 404);
  }
  const deploy = await triggerDeployHook(env);
  await execute(
    env,
    `INSERT INTO admin_logs (user_id, action, resource_type, resource_id, message) VALUES (?, ?, 'post', ?, ?)`,
    [
      user.id,
      deploy.triggered ? 'redeploy_ok' : 'redeploy_failed',
      id,
      deploy.triggered ? null : `手动重试部署失败：${deploy.error ?? '未知错误'}`,
    ]
  );
  return json({
    success: true,
    data: { deploy_triggered: deploy.triggered, deploy_error: deploy.error },
  });
}

/**
 * PUT /api/admin/media/:id — update an asset's alt text.
 *
 * Item 14 — the alt text lives on the media row, so editing it there
 * fixes every article that embeds the image.
 */
export async function handleMediaUpdate(request: Request, env: Env, id: number): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    return badRequest('请求格式错误');
  }
  const alt = body.alt === null ? null : String(body.alt ?? '').slice(0, 500);
  const width = body.width === undefined || body.width === null ? null : Math.round(Number(body.width)) || null;
  const height =
    body.height === undefined || body.height === null ? null : Math.round(Number(body.height)) || null;

  const sets: string[] = [];
  const params: unknown[] = [];
  if (body.alt !== undefined) {
    sets.push('alt = ?');
    params.push(alt);
  }
  if (body.width !== undefined) {
    sets.push('width = ?');
    params.push(width);
  }
  if (body.height !== undefined) {
    sets.push('height = ?');
    params.push(height);
  }
  if (sets.length === 0) return badRequest('没有要保存的字段');

  sets.push(`updated_at = datetime('now')`);
  const result = await execute(env, `UPDATE media SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  if (!result.meta || result.meta.changes === 0) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: '媒体不存在' } }, 404);
  }
  const row = await queryFirst<any>(
    env,
    `SELECT id, filename, original_filename, mime_type, size, url, alt, width, height, created_at, updated_at
     FROM media WHERE id = ?`,
    [id]
  );
  // The alt text is rendered on the public site (it is the text a
  // screen reader reads and the caption under the image), so changing
  // it changes the site and needs a rebuild.
  const deploy = await triggerDeployHook(env);
  return json({
    success: true,
    data: { ...row, deploy_triggered: deploy.triggered, deploy_error: deploy.error },
  });
}

/**
 * GET /api/admin/media/usage
 *
 * Which posts reference each media file (item 14 — "被哪些文章引用").
 * The media URL is matched against the post bodies.
 */
export async function handleMediaUsage(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' } }, 401);
  }
  const url = new URL(request.url);
  const mediaId = parseInt(url.searchParams.get('id') ?? '0', 10);
  if (!Number.isFinite(mediaId) || mediaId <= 0) return badRequest('媒体 ID 无效');

  const media = await queryFirst<{ url: string; filename: string }>(
    env,
    `SELECT url, filename FROM media WHERE id = ?`,
    [mediaId]
  );
  if (!media) {
    return json({ success: false, error: { code: 'NOT_FOUND', message: '媒体不存在' } }, 404);
  }

  const needles = [media.url];
  if (media.filename) needles.push(media.filename);
  const rows = await queryAll<any>(
    env,
    `SELECT id, collection, locale, slug, title, status
     FROM posts
     WHERE instr(content, ?) > 0 OR instr(cover_image, ?) > 0
     ORDER BY updated_at DESC LIMIT 50`,
    [media.url, media.url]
  );

  return json({ success: true, data: { items: rows } });
}

/**
 * The scheduled-publish cron.
 *
 * Called by the Worker's cron trigger (every 5 minutes). Any draft whose
 * scheduled_at has passed becomes published.
 */
export async function publishScheduledPosts(env: Env): Promise<number> {
  const due = await queryAll<{ id: number; title: string }>(
    env,
    `SELECT id, title FROM posts
     WHERE status = 'draft'
       AND scheduled_at IS NOT NULL
       AND scheduled_at <= ?
     ORDER BY scheduled_at LIMIT 20`,
    [new Date().toISOString().replace('T', ' ').slice(0, 19)]
  );
  if (due.length === 0) return 0;

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  for (const post of due) {
    await execute(
      env,
      `UPDATE posts SET status = 'published', published_at = ?, updated_at = datetime('now') WHERE id = ?`,
      [now, post.id]
    );
    await execute(
      env,
      `INSERT INTO admin_logs (action, resource_type, resource_id, message) VALUES ('scheduled_publish', 'post', ?, ?)`,
      [post.id, `定时发布：${post.title}`]
    );
  }

  await triggerDeployHook(env);
  return due.length;
}

/**
 * The reconciliation safety net.
 *
 * The site is a static build: the public pages are produced by a
 * Cloudflare Pages build, and a build only happens when something
 * fires the deploy hook. Every write path that changes what the site
 * shows has to fire it — and a path that forgets leaves the site
 * serving stale content until something unrelated happens to trigger a
 * build. That is exactly how the note published on 2026-11-19 stayed
 * invisible.
 *
 * All the known paths fire the hook now. This function is the backstop
 * for the ones that do not exist yet: it compares the DATABASE with the
 * LIVE SITE and rebuilds when they disagree.
 *
 * How the comparison works:
 *
 *   - The database side: the newest `updated_at` among the published
 *     posts, and the set of published post URLs.
 *   - The site side: `search-index.json` — a file the build writes. It
 *     carries `contentSyncedAt` (the moment the build read D1) and the
 *     list of URLs the build produced.
 *
 * The site is behind when either
 *   (a) a published post was changed after `contentSyncedAt`, or
 *   (b) the URL sets differ (an article was added, archived or deleted
 *       without the site being rebuilt).
 *
 * A cooldown keeps this from starting a build every five minutes: a
 * build takes ~3 minutes, and the site cannot be compared again until
 * the new deployment is live.
 */
export async function ensureSiteInSync(
  env: Env
): Promise<{ stale: boolean; reason: string; triggered: boolean }> {
  const siteUrl = String((env as any).SITE_URL || 'https://blog.frank2025.com');
  const COOLDOWN_MS = 10 * 60 * 1000;

  // ── the database side ────────────────────────────────────────────────
  const published = await queryAll<{ locale: string; collection: string; slug: string; updated_at: string }>(
    env,
    `SELECT locale, collection, slug, updated_at FROM posts WHERE status = 'published'`
  );
  if (published.length === 0) {
    return { stale: false, reason: 'no published posts', triggered: false };
  }

  const dbUrls = new Set<string>();
  let latestMs = 0;
  for (const p of published) {
    const dir = p.collection === 'notes' ? 'notes' : 'blog';
    dbUrls.add(`/${p.locale}/${dir}/${p.slug}`);
    const ms = Date.parse(`${String(p.updated_at).replace(' ', 'T')}Z`);
    if (!Number.isNaN(ms) && ms > latestMs) latestMs = ms;
  }

  // ── the site side ────────────────────────────────────────────────────
  let index: any = null;
  try {
    const res = await fetch(`${siteUrl}/search-index.json?cb=${Date.now()}`, {
      headers: { 'User-Agent': 'frank-blog-cms-reconcile/1.0', Accept: 'application/json' },
    });
    if (!res.ok) {
      return { stale: false, reason: `site index HTTP ${res.status}`, triggered: false };
    }
    index = await res.json();
  } catch (e: any) {
    // The site is unreachable (or the Worker has no outbound access).
    // Do NOT rebuild on a guess — a false positive would start a build
    // every five minutes.
    return { stale: false, reason: `site unreachable: ${e?.message || e}`, triggered: false };
  }

  const siteUrls = new Set<string>();
  const entries = index?.entries ?? {};
  for (const list of Object.values(entries) as any[]) {
    for (const item of list as any[]) {
      if (item?.url) siteUrls.add(item.url);
    }
  }

  const syncedAtRaw = index?.contentSyncedAt ?? index?.generatedAt ?? null;
  const syncedMs = syncedAtRaw ? Date.parse(syncedAtRaw) : NaN;

  // ── the comparison ───────────────────────────────────────────────────
  let reason = '';
  if (!Number.isNaN(syncedMs) && latestMs > syncedMs) {
    reason = `有已发布文章在站点构建之后被修改（最新 ${new Date(latestMs).toISOString()} > 构建于 ${new Date(syncedMs).toISOString()}）`;
  } else {
    const missing = [...dbUrls].filter((u) => !siteUrls.has(u));
    const extra = [...siteUrls].filter((u) => !dbUrls.has(u));
    if (missing.length > 0) {
      reason = `站点缺少 ${missing.length} 篇已发布文章（例如 ${missing[0]}）`;
    } else if (extra.length > 0) {
      reason = `站点还残留 ${extra.length} 篇已删除/已归档的文章（例如 ${extra[0]}）`;
    }
  }

  if (!reason) {
    return { stale: false, reason: 'site is in sync', triggered: false };
  }

  // ── the cooldown ─────────────────────────────────────────────────────
  const lastRow = await queryFirst<{ value: string }>(
    env,
    `SELECT value FROM settings WHERE key = 'last_reconcile_deploy_at'`
  );
  const lastMs = lastRow?.value ? Date.parse(lastRow.value) : NaN;
  if (!Number.isNaN(lastMs) && Date.now() - lastMs < COOLDOWN_MS) {
    return { stale: true, reason: `${reason}（冷却中，稍后重试）`, triggered: false };
  }

  // ── rebuild ──────────────────────────────────────────────────────────
  const deploy = await triggerDeployHook(env);
  const now = new Date().toISOString();
  await execute(
    env,
    `INSERT INTO settings (key, value, updated_at) VALUES ('last_reconcile_deploy_at', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [now]
  );
  await execute(
    env,
    `INSERT INTO admin_logs (action, resource_type, message) VALUES (?, 'site', ?)`,
    [
      deploy.triggered ? 'site_reconcile_deploy_ok' : 'site_reconcile_deploy_failed',
      deploy.triggered ? `站点与数据库不一致，已自动重建：${reason}` : `站点与数据库不一致，重建失败：${reason}（${deploy.error ?? '未知错误'}）`,
    ]
  );

  return { stale: true, reason, triggered: deploy.triggered };
}

/**
 * A read-only report: is the live site in sync with the database?
 *
 * Shown in the admin so the state can be checked without waiting for
 * the cron. It never triggers a rebuild — that is the cron's job.
 */
export async function getSiteStatus(env: Env): Promise<{
  in_sync: boolean;
  reason: string;
  content_synced_at: string | null;
  latest_update: string | null;
  site_urls: number;
  db_urls: number;
}> {
  const siteUrl = String((env as any).SITE_URL || 'https://blog.frank2025.com');

  const published = await queryAll<{ locale: string; collection: string; slug: string; updated_at: string }>(
    env,
    `SELECT locale, collection, slug, updated_at FROM posts WHERE status = 'published'`
  );
  const dbUrls = new Set<string>();
  let latestMs = 0;
  let latestRaw: string | null = null;
  for (const p of published) {
    const dir = p.collection === 'notes' ? 'notes' : 'blog';
    dbUrls.add(`/${p.locale}/${dir}/${p.slug}`);
    const ms = Date.parse(`${String(p.updated_at).replace(' ', 'T')}Z`);
    if (!Number.isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      latestRaw = p.updated_at;
    }
  }

  let index: any = null;
  try {
    const res = await fetch(`${siteUrl}/search-index.json?cb=${Date.now()}`, {
      headers: { 'User-Agent': 'frank-blog-cms-reconcile/1.0', Accept: 'application/json' },
    });
    if (!res.ok) {
      return {
        in_sync: false,
        reason: `无法读取站点索引（HTTP ${res.status}）`,
        content_synced_at: null,
        latest_update: latestRaw,
        site_urls: 0,
        db_urls: dbUrls.size,
      };
    }
    index = await res.json();
  } catch (e: any) {
    return {
      in_sync: false,
      reason: `无法访问站点：${e?.message || e}`,
      content_synced_at: null,
      latest_update: latestRaw,
      site_urls: 0,
      db_urls: dbUrls.size,
    };
  }

  const siteUrls = new Set<string>();
  for (const list of Object.values(index?.entries ?? {}) as any[]) {
    for (const item of list as any[]) if (item?.url) siteUrls.add(item.url);
  }

  const syncedAtRaw = index?.contentSyncedAt ?? index?.generatedAt ?? null;
  const syncedMs = syncedAtRaw ? Date.parse(syncedAtRaw) : NaN;

  let reason = '站点与数据库一致';
  let inSync = true;
  if (!Number.isNaN(syncedMs) && latestMs > syncedMs) {
    inSync = false;
    reason = '有已发布文章在站点构建之后被修改，后台会自动重建';
  } else {
    const missing = [...dbUrls].filter((u) => !siteUrls.has(u));
    const extra = [...siteUrls].filter((u) => !dbUrls.has(u));
    if (missing.length > 0) {
      inSync = false;
      reason = `站点缺少 ${missing.length} 篇已发布文章，后台会自动重建`;
    } else if (extra.length > 0) {
      inSync = false;
      reason = `站点还残留 ${extra.length} 篇已删除/已归档的文章，后台会自动重建`;
    }
  }

  return {
    in_sync: inSync,
    reason,
    content_synced_at: syncedAtRaw,
    latest_update: latestRaw,
    site_urls: siteUrls.size,
    db_urls: dbUrls.size,
  };
}

export { MAX_LIMIT, DEFAULT_LIMIT };
