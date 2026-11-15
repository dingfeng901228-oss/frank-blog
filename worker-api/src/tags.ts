/**
 * Tag normalization.
 *
 * THE BUG THIS FIXES
 * -----------------
 * A note was tagged `["AI", "AIエージェント.AI Agent", "Hermes", "OpenClaw"]` —
 * two distinct tags that had been pasted together with a period. The tag
 * pages are generated from the tag list, so the combined string produced a
 * page at `/ja/notes/tag/AIエージェント.AI Agent` that no article was ever
 * tagged with, while the two real tags had no page at all. The link was
 * therefore dead in both directions.
 *
 * THE RULE
 * --------
 * A tag that contains a separator is split into its parts, but only when
 * one of the following holds:
 *
 *   1. Every part is a tag the site already knows about.
 *   2. The separator touches a CJK character.
 *
 * Condition 2 is what keeps legitimate dotted names intact: "Node.js" has
 * no CJK around the period, so it stays whole, while
 * "AIエージェント.AI Agent" splits cleanly.
 */

/**
 * Split a tag on the separators that indicate two tags were concatenated:
 * a full-width or half-width period, or an ideographic comma.
 */
const SEPARATORS = /[.．、]/;

/** CJK ideographs, kana, and the full-width punctuation around them. */
const CJK_CHAR = /[぀-ヿ㐀-鿿豈-﫿＀-￯]/;

/**
 * Split a possibly-concatenated tag into its parts.
 *
 * @param tag      the raw tag as stored
 * @param known    every tag that already exists somewhere on the site
 * @returns        the parts to use, or `[tag]` when it must stay whole
 */
export function splitTag(tag: string, known: Set<string>): string[] {
  const raw = (tag ?? '').trim()
  if (!raw || !SEPARATORS.test(raw)) return [raw]

  const parts = raw
    .split(SEPARATORS)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

  // Fewer than two usable parts means the separator was not a tag join
  // (e.g. a trailing dot or a stray separator) — leave the tag alone.
  if (parts.length < 2) return [raw]

  // Condition 1: every part is a tag the site already knows.
  if (parts.every((p) => known.has(p))) return parts

  // Condition 2: the separator touches a CJK character.
  const sepIndex = raw.search(SEPARATORS)
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
 *
 * @param tags  the raw tag list from the request body
 * @param known every tag that already exists somewhere on the site
 */
export function normalizeTags(tags: unknown, known: Set<string>): string[] {
  if (!Array.isArray(tags)) return []

  const out: string[] = []
  const seen = new Set<string>()

  for (const entry of tags) {
    if (typeof entry !== 'string') continue
    for (const part of splitTag(entry, known)) {
      const key = part.trim()
      if (!key) continue
      // Case-insensitive de-duplication, but keep the FIRST spelling.
      const dedupeKey = key.toLowerCase()
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      out.push(key)
    }
  }

  return out
}
