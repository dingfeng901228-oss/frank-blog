// worker-api/src/autotranslate.ts
//
// The auto-translation publish flow.
//
// WHAT HAPPENS WHEN FRANK PUBLISHES A CHINESE ARTICLE
// ----------------------------------------------------
// 1. The Chinese post is published (status='published', published_at set).
// 2. For each target locale (ja, en) that does NOT yet have a sibling row
//    for the same (collection, slug), the Worker:
//      - translates title, description, body and tags,
//      - inserts a new post row with the SAME slug in the target locale,
//      - publishes it immediately.
// 3. One deploy hook fires at the end, so the site is rebuilt once with all
//    three languages present.
//
// WHY THE SAME SLUG
// -----------------
// The blog's cross-locale identity IS the slug: /ja/notes/foo and
// /en/notes/foo are the same article, and the locale switcher in the
// editor looks the sibling up by (collection, slug, locale). The DB's
// UNIQUE(collection, locale, slug) constraint enforces one row per locale.
//
// WHY EXISTING SIBLINGS ARE NEVER OVERWRITTEN
// --------------------------------------------
// If a ja/en row already exists, it was either hand-written or already
// machine-translated and then edited by Frank. Either way it is HIS text
// now, so auto-translation leaves it alone. To re-translate, Frank uses
// the explicit "retranslate" action, which overwrites the target locale.

import {
  execute,
  queryFirst,
  buildDescriptionRaw,
  type Env,
  type Post,
} from './cms';
import {
  translateMarkdown,
  translatePlain,
  translateTags,
  type Locale,
} from './translate';

export const TARGET_LOCALES: Locale[] = ['ja', 'en'];

export interface TranslationOutcome {
  locale: Locale;
  status: 'created' | 'skipped' | 'failed';
  id?: number;
  error?: string;
}

/**
 * Translate a published post into the locales that don't have it yet and
 * publish those versions.
 *
 * Never throws — a translation failure must not block the publish of the
 * source article. The failures come back in the outcome list so the CMS
 * can tell Frank what happened.
 */
export async function autoTranslateSiblings(
  env: Env,
  post: Post,
  opts: { force?: boolean } = {}
): Promise<TranslationOutcome[]> {
  if (!env.AI) {
    // AI binding missing (e.g. old deploy). Report it rather than
    // silently doing nothing.
    return TARGET_LOCALES.map((locale) => ({
      locale,
      status: 'failed' as const,
      error: 'Workers AI binding is not configured',
    }));
  }

  const source = post.locale as Locale;
  const sourceTags = parseTags(post.tags);

  // The target locales are translated CONCURRENTLY, not one after the
  // other. Each locale's body is split into chunks that are translated in
  // parallel too, so a 4k-char article ends up as ~6 simultaneous AI calls
  // and the whole publish finishes in ~20 seconds instead of ~40.
  const results = await Promise.all(
    TARGET_LOCALES.map(async (target): Promise<TranslationOutcome> => {
      if (target === source) {
        return { locale: target, status: 'skipped' };
      }

      const existing = await queryFirst<{ id: number; status: string }>(
        env,
        `SELECT id, status FROM posts WHERE collection = ? AND locale = ? AND slug = ?`,
        [post.collection, target, post.slug]
      );

      if (existing && !opts.force) {
        // A sibling already exists — leave it alone. It may have been
        // hand-edited since it was machine-translated.
        return { locale: target, status: 'skipped', id: existing.id };
      }

      try {
        // The three translations are independent — run them together.
        const [titleRes, descRes, bodyRes, tagsRes] = await Promise.all([
          translatePlain(env, post.title, source, target),
          translatePlain(env, post.description_text, source, target),
          translateMarkdown(env, post.content, source, target),
          sourceTags.length > 0
            ? translateTags(env, sourceTags, source, target)
            : Promise.resolve({ text: '', ok: true }),
        ]);

        if (!bodyRes.ok) {
          return {
            locale: target,
            status: 'failed',
            error: bodyRes.error || 'body translation failed',
          };
        }

        const translatedTags = tagsRes.ok
          ? tagsRes.text.split('\n').map((t) => t.trim()).filter(Boolean)
          : sourceTags;

        const now = new Date().toISOString();

        if (existing && opts.force) {
          await execute(
            env,
            `UPDATE posts
               SET title = ?, description_raw = ?, description_text = ?, content = ?,
                   tags = ?, status = 'published', published_at = COALESCE(published_at, ?),
                   auto_translated = 1, updated_at = datetime('now')
             WHERE id = ?`,
            [
              titleRes.text,
              buildDescriptionRaw(descRes.text),
              descRes.text,
              bodyRes.text,
              translatedTags.length > 0 ? JSON.stringify(translatedTags) : null,
              now,
              existing.id,
            ]
          );
          return { locale: target, status: 'created', id: existing.id };
        }

        const insertResult = await execute(
          env,
          `INSERT INTO posts
             (collection, locale, slug, title, description_raw, description_text, content,
              content_format, excerpt, cover_image, status, published_at, author_id,
              reading_time, is_featured, tags, auto_translated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, 1)`,
          [
            post.collection,
            target,
            post.slug,
            titleRes.text,
            buildDescriptionRaw(descRes.text),
            descRes.text,
            bodyRes.text,
            post.content_format || 'mdx',
            null,
            post.cover_image,
            post.published_at || now,
            null,
            post.reading_time,
            0, // a machine translation is never "featured" on its own
            translatedTags.length > 0 ? JSON.stringify(translatedTags) : null,
          ]
        );

        return {
          locale: target,
          status: 'created',
          id: insertResult.meta?.last_row_id,
        };
      } catch (e: any) {
        return {
          locale: target,
          status: 'failed',
          error: e?.message || 'translation failed',
        };
      }
    })
  );

  return results;
}

function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}
