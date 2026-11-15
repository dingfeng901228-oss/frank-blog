/**
 * Reading time — one calculation for the whole site.
 *
 * WHY NOT `reading-time`
 * ----------------------
 * The `reading-time` package counts WORDS, splitting on whitespace. That
 * works for English, and completely fails for Chinese and Japanese, which
 * do not put spaces between words: a 2,600-character Japanese article
 * looked like a single "word" and came out as "1 min read".
 *
 * So the article showed "1 min read" on the list page and on the article
 * page alike — wrong, and wrong in a way that looked like a bug rather
 * than a rounding issue.
 *
 * THE CALCULATION
 * ---------------
 *   Japanese / Chinese / Korean : ~500 characters per minute
 *   English and other Latin text : ~220 words per minute
 *
 * The two counts are added and rounded up, with a floor of one minute.
 * Markdown syntax (code fences, image and link markup, heading markers)
 * is stripped first so the counts reflect prose, not syntax.
 */

/** CJK ideographs, kana, Hangul, and full-width punctuation. */
const CJK = /[぀-ヿ㐀-鿿가-힣豈-﫿-﫿＀-￯]/g

/** A word made of Latin letters, digits, or apostrophes. */
const LATIN_WORD = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g

/** Characters per minute for CJK prose. */
const CJK_CHARS_PER_MINUTE = 500

/** Words per minute for Latin prose. */
const LATIN_WORDS_PER_MINUTE = 220

/**
 * Strip the Markdown syntax that should not count as prose.
 */
function stripMarkdown(source: string): string {
  return source
    // Fenced code blocks, including the fence markers.
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    // Inline code.
    .replace(/`[^`\n]*`/g, ' ')
    // Images: ![alt](url) — keep the alt text, it is prose the reader sees.
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Links: [text](url) — keep the text.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Reference-style links.
    .replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, ' ')
    // Heading markers, blockquote markers, list markers.
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Horizontal rules.
    .replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, ' ')
    // Emphasis markers.
    .replace(/[*_~]{1,3}/g, '')
    // HTML tags.
    .replace(/<[^>]+>/g, ' ')
}

/**
 * The reading time of a piece of content, in whole minutes.
 *
 * @returns at least 1
 */
export function calculateReadingMinutes(content: string): number {
  const text = stripMarkdown(content ?? '')

  const cjkChars = text.match(CJK)?.length ?? 0
  const latinWords = text.match(LATIN_WORD)?.length ?? 0

  const minutes = cjkChars / CJK_CHARS_PER_MINUTE + latinWords / LATIN_WORDS_PER_MINUTE
  return Math.max(1, Math.ceil(minutes))
}

/**
 * The reading time, formatted for the reader's language.
 *
 *   ja → "約5分"      zh → "约5分钟"      en → "5 min read"
 */
export function formatReadingTime(minutes: number, locale: string = 'ja'): string {
  const m = Math.max(1, Math.round(minutes || 1))
  if (locale === 'zh') return `约${m}分钟`
  if (locale === 'en') return `${m} min read`
  return `約${m}分`
}

/**
 * The reading time of a piece of content, already localized.
 */
export function readingTimeFor(content: string, locale: string = 'ja'): string {
  return formatReadingTime(calculateReadingMinutes(content), locale)
}

/**
 * The reading time in whole minutes, for schema.org and similar.
 */
export function readingMinutesFor(content: string): number {
  return calculateReadingMinutes(content)
}
