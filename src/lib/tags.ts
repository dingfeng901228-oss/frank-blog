/**
 * The one place that decides what a tag URL looks like.
 *
 * THE BUG THIS FIXES
 * -----------------
 * The tag pages used to be generated with
 *
 *     params.push({ locale, tag: encodeURIComponent(tag) })
 *
 * and linked with
 *
 *     href={`/${locale}/blog/tag/${encodeURIComponent(tag)}`}
 *
 * Both encode once, but they encode *different things*. `generateStaticParams`
 * returned an ALREADY-ENCODED string, and Next.js wrote that string into the
 * file name as-is: `out/ja/blog/tag/%E4%BD%9C%E5%86%99.html`. The browser, on
 * the other hand, asks for the URL it was given and the CDN decodes the path
 * before looking for a file, so it looked for `out/ja/blog/tag/写作.html`.
 * The two never met, so every tag with a space or a non-ASCII character
 * 404'd. Pure-ASCII single-word tags survived because
 * `encodeURIComponent('writing') === 'writing'`.
 *
 * THE RULE
 * --------
 * A tag URL is
 *
 *     /<locale>/<blog|notes>/tag/<encodeURIComponent(tag)>
 *
 * exactly once. `encodeURIComponent` is the only encoder: a space becomes
 * `%20`, a slash becomes `%2F`, and `A-Z a-z 0-9 - _ . ! ~ * ' ( )` are left
 * alone. Non-ASCII characters become their UTF-8 percent encoding, which is
 * what the CDN decodes back when it resolves the request.
 *
 * The route parameter arrives DECODED (Next.js hands the raw segment to the
 * page), so the page matches against the raw tag. `decodeTagParam` below is
 * idempotent: it decodes only when the value still looks encoded, so it is
 * safe for both a decoded parameter and a legacy double-encoded one.
 */

/** The collections a tag page can live under. */
export type TagCollection = 'blog' | 'notes'

/**
 * Encode a tag into the single path segment used by every tag URL.
 *
 * Apply this ONCE. Applying it twice turns `%20` into `%2520`.
 */
export function encodeTag(tag: string): string {
  return encodeURIComponent(tag)
}

/**
 * Turn a route parameter back into the raw tag name.
 *
 * Idempotent: a raw tag is returned unchanged, and an encoded tag is
 * decoded. A tag that contains a literal `%` (and is therefore not a valid
 * encoding) is left alone rather than mangled by a failed decode.
 */
export function decodeTagParam(param: string): string {
  if (!param) return param
  // A decoded tag never contains a '%'. If it does, it is still encoded.
  if (!param.includes('%')) return param
  try {
    return decodeURIComponent(param)
  } catch {
    // Malformed escape sequence: keep the raw value rather than throwing.
    return param
  }
}

/**
 * The path segment for a tag, e.g. `Japanese%20learning`.
 */
export function tagSegment(tag: string): string {
  return encodeTag(tag)
}

/**
 * The full path for a tag page, e.g. `/ja/blog/tag/Japanese%20learning`.
 */
export function tagPath(locale: string, collection: TagCollection, tag: string): string {
  return `/${locale}/${collection}/tag/${tagSegment(tag)}`
}

/**
 * The full href for a tag page.
 */
export function tagHref(locale: string, collection: TagCollection, tag: string): string {
  return tagPath(locale, collection, tag)
}

/**
 * The canonical, absolute URL for a tag page. Used in `alternates`.
 */
export function tagCanonical(
  origin: string,
  locale: string,
  collection: TagCollection,
  tag: string
): string {
  return `${origin}${tagPath(locale, collection, tag)}`
}

/**
 * Tag normalization — the same rule the CMS applies on save, applied at
 * build time so the static site can never ship a dead tag link.
 *
 * THE BUG THIS FIXES
 * -----------------
 * A note was tagged `["AI", "AIエージェント.AI Agent", "Hermes", "OpenClaw"]` —
 * two distinct tags pasted together with a period. The tag pages are
 * generated from the tag list, so the combined string produced a page at
 * `/ja/notes/tag/AIエージェント.AI Agent` that no article carried, while
 * the two real tags had no page at all. Both directions of that link were
 * dead.
 *
 * THE RULE
 * --------
 * A tag containing a period separator is split into its parts, but ONLY
 * when every part is a tag the site already knows about. That condition
 * is what keeps legitimate dotted names intact:
 *
 *   "AIエージェント.AI Agent" → "AIエージェント" + "AI Agent"   (both known)
 *   "Node.js"                 → "Node.js"                      ("js" unknown)
 */

/** Separators that indicate two tags were concatenated. */
const TAG_SEPARATORS = /[.．、]/

/** CJK ideographs, kana, and the full-width punctuation around them. */
const CJK_CHAR = /[぀-ヿ㐀-鿿豈-﫿＀-￯]/

/**
 * Split a possibly-concatenated tag into its parts.
 *
 * The tag is split when EITHER of these holds:
 *
 *   1. Every part is already a tag on the site. That catches pure-ASCII
 *      joins like "AI.Agent" when both halves are known tags.
 *   2. The separator touches a CJK character. That catches the Japanese
 *      case "AIエージェント.AI Agent", where the first half is a brand new
 *      tag that nothing else uses yet.
 *
 * Condition 2 is what keeps legitimate dotted product names intact:
 * "Node.js" has no CJK around the period, so it stays whole.
 *
 * @param tag   the raw tag as stored
 * @param known every tag that already exists somewhere on the site
 */
export function splitTag(tag: string, known: Set<string>): string[] {
  const raw = (tag ?? '').trim()
  if (!raw || !TAG_SEPARATORS.test(raw)) return [raw]

  const parts = raw
    .split(TAG_SEPARATORS)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  // Fewer than two usable parts means the separator was not a tag join
  // (e.g. a trailing dot or a stray separator) — leave the tag alone.
  if (parts.length < 2) return [raw]

  // Condition 1: every part is a tag the site already knows.
  if (parts.every((p) => known.has(p))) return parts

  // Condition 2: the separator touches a CJK character.
  const sepIndex = raw.search(TAG_SEPARATORS)
  const before = raw.slice(0, sepIndex)
  const after = raw.slice(sepIndex + 1)
  const touchesCjk =
    CJK_CHAR.test(before.slice(-1)) || CJK_CHAR.test(after.slice(0, 1))
  if (touchesCjk) return parts

  return [raw]
}

/**
 * Normalize a tag list: split joined tags, drop empties, de-duplicate
 * while preserving order.
 */
export function normalizeTags(tags: string[] | undefined, known: Set<string>): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  for (const entry of tags ?? []) {
    if (typeof entry !== 'string') continue
    for (const part of splitTag(entry, known)) {
      const key = part.trim()
      if (!key) continue
      const dedupeKey = key.toLowerCase()
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      out.push(key)
    }
  }

  return out
}
