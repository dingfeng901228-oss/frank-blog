// src/lib/cms/format.ts
// Shared formatting for the admin SPA.
//
// Item 9 + 11 — every date in the admin uses ONE format:
//     YYYY-MM-DD HH:mm
// The audit found the editor printing raw ISO strings
// ("2026-08-11T00:00:00.000Z") next to SQLite datetimes
// ("2026-09-30 11:04:52") next to relative times ("3 分钟前").
// This module is the single place that turns any of those into the
// one format the admin shows.

/**
 * The D1 rows mix three date shapes:
 *   - "2026-08-11T00:00:00.000Z"   (ISO with an explicit zone)
 *   - "2026-09-30 11:04:52"        (SQLite datetime('now') — UTC)
 *   - "2026-09-30"                 (a bare date, used by published_at)
 *
 * The bare date must NOT be shifted: a post published on the 30th in
 * Tokyo must not show up on the 31st because its date was read as UTC
 * midnight. So a date-only value is printed exactly as it is stored.
 */
function parseDate(value: string): { date: Date; dateOnly: boolean } | null {
  const s = value.trim();

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dateOnly) {
    return {
      date: new Date(Date.UTC(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3])),
      dateOnly: true,
    };
  }

  // SQLite datetime — no zone marker, but the value is UTC.
  const sqlite = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (sqlite) {
    return {
      date: new Date(
        Date.UTC(
          +sqlite[1],
          +sqlite[2] - 1,
          +sqlite[3],
          +sqlite[4],
          +sqlite[5],
          +(sqlite[6] || 0)
        )
      ),
      dateOnly: false,
    };
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return { date: parsed, dateOnly: false };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * The admin's one date format: "YYYY-MM-DD HH:mm".
 *
 * Datetimes are converted to the browser's local time (JST for Frank);
 * a bare date is printed unchanged.
 */
export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = parseDate(String(value));
  if (!parsed) return String(value);
  if (parsed.dateOnly) {
    const d = parsed.date;
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} 00:00`;
  }
  const d = parsed.date;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/** Just the date part: "YYYY-MM-DD". */
export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const full = formatDateTime(value);
  return full.slice(0, 10);
}

/** The value a <input type="datetime-local"> needs: "YYYY-MM-DDTHH:mm". */
export function toDateTimeLocal(value?: string | null): string {
  if (!value) return '';
  const parsed = parseDate(String(value));
  if (!parsed) return '';
  if (parsed.dateOnly) return `${String(value).slice(0, 10)}T00:00`;
  const d = parsed.date;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/**
 * The word count of a piece of text.
 *
 * Japanese and Chinese are written without spaces, so a naive
 * split(/\s+/).length would report 1 for a whole article. Count CJK
 * characters individually and everything else word by word.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const cjk = text.match(/[぀-ヿ㐀-䶿一-鿿豈-﫿]/g);
  const cjkCount = cjk ? cjk.length : 0;
  const latin = text
    .replace(/[぀-ヿ㐀-䶿一-鿿豈-﫿]/g, ' ')
    .trim();
  const latinWords = latin ? latin.split(/\s+/).filter(Boolean).length : 0;
  return cjkCount + latinWords;
}

/**
 * The estimated reading time, in minutes.
 *
 * CJK is read at roughly 500 characters a minute, everything else at
 * roughly 200 words a minute. The public site uses the same rule (see
 * src/lib/reading-time.ts), so the number the editor shows matches the
 * number the article page shows.
 */
export function estimateReadingMinutes(text: string): number {
  const words = countWords(text);
  const cjk = text.match(/[぀-ヿ㐀-䶿一-鿿豈-﫿]/g)?.length ?? 0;
  const minutes = cjk / 500 + (words - cjk) / 200;
  return Math.max(1, Math.round(minutes));
}

/** "预计阅读 3 分钟" */
export function readingTimeLabel(text: string): string {
  return `预计阅读 ${estimateReadingMinutes(text)} 分钟`;
}

/** The status of an article, in Chinese. */
export function formatStatus(status?: string | null): string {
  switch (status) {
    case 'published':
      return '已发布';
    case 'draft':
      return '草稿';
    case 'archived':
      return '已归档';
    default:
      return status || '—';
  }
}

/**
 * The activity log's event names, in Chinese.
 *
 * Item 11 — the log page printed raw event ids such as
 * "update_post_deploy_failed". Every known event has a Chinese label
 * here; an unknown one falls back to the raw id so nothing is hidden.
 */
export function formatAction(action: string): string {
  const map: Record<string, string> = {
    login: '登录',
    logout: '退出登录',
    login_failed: '登录失败',
    publish_post: '发布文章',
    unpublish_post: '取消发布文章',
    publish_post_failed: '发布文章失败',
    unpublish_post_failed: '取消发布文章失败',
    create_post: '新建文章',
    update_post: '更新文章',
    delete_post: '删除文章',
    update_post_deploy_ok: '文章更新，部署成功',
    update_post_deploy_failed: '文章更新，部署失败',
    create_post_deploy_ok: '文章创建，部署成功',
    create_post_deploy_failed: '文章创建，部署失败',
    publish_post_deploy_ok: '文章发布，部署成功',
    publish_post_deploy_failed: '文章发布，部署失败',
    bulk_publish_deploy_ok: '批量发布，部署成功',
    bulk_publish_deploy_failed: '批量发布，部署失败',
    bulk_delete: '批量删除文章',
    redeploy_ok: '手动重试部署成功',
    redeploy_failed: '手动重试部署失败',
    scheduled_publish: '定时发布',
    api_error: '接口异常',
    delete_media: '删除媒体',
    upload_media: '上传媒体',
    create_category: '新建分类',
    update_category: '更新分类',
    delete_category: '删除分类',
    create_tag: '新建标签',
    update_tag: '更新标签',
    delete_tag: '删除标签',
  };
  if (map[action]) return map[action];
  if (action.endsWith('_failed')) return `${formatAction(action.replace(/_failed$/, ''))}失败`;
  return action;
}

/** The collection of an article, in Chinese. */
export function formatCollection(collection?: string | null): string {
  switch (collection) {
    case 'posts':
      return '博客';
    case 'notes':
      return '随笔';
    default:
      return collection || '—';
  }
}

/** The locale of an article, in Chinese. */
export function formatLocale(locale?: string | null): string {
  switch (locale) {
    case 'ja':
      return '日文';
    case 'zh':
      return '中文';
    case 'en':
      return '英文';
    default:
      return locale || '—';
  }
}

/** "共 38 条 · 第 1/2 页" */
export function formatPagination(total: number, page: number, limit: number): string {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  return `共 ${total} 条 · 第 ${page}/${pages} 页`;
}
