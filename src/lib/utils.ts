import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a frontmatter date (always "YYYY-MM-DD") into a local Date.
 *
 * WHY NOT `new Date(str)`:
 *   `new Date('2026-09-30')` is parsed as UTC midnight. Rendering it with
 *   toLocaleDateString() in a timezone behind UTC (UTC-8 … UTC-3) yields
 *   "September 29" — the day silently shifts by one. The build server and
 *   the reader's browser are in different timezones, so the same article
 *   could show two different dates depending on who builds it.
 *
 *   Parsing the parts and constructing a LOCAL date makes the value
 *   timezone-independent: "2026-09-30" always renders as September 30,
 *   everywhere.
 */
export function parseDateOnly(date: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((date ?? '').trim())
  if (!m) {
    const d = new Date(date)
    if (Number.isNaN(d.getTime())) return new Date(0)
    return d
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/**
 * The site-wide date format.
 *
 *   ja → 2026年9月30日
 *   zh → 2026年9月30日
 *   en → September 30, 2026
 *
 * Every surface (home cards, blog list, notes list, article pages,
 * archives, RSS) must use this one function so a given article shows the
 * same date string everywhere.
 */
export function formatDate(date: string, locale: string = 'ja'): string {
  const d = parseDateOnly(date)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString(
    locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-US' : 'ja-JP',
    { year: 'numeric', month: 'long', day: 'numeric' }
  )
}

/**
 * The split date used by the large "date" block on the blog/notes list
 * cards: a big day number with a smaller "year / month" line above it.
 * Returned as parts so the card can style them independently WITHOUT the
 * string ever wrapping mid-date (the old inline "2026年8月／19日" broke
 * onto two lines at narrow widths).
 */
export function formatDateParts(date: string, locale: string = 'ja'): {
  year: string
  month: string
  day: string
} {
  const d = parseDateOnly(date)
  if (Number.isNaN(d.getTime())) {
    return { year: date, month: '', day: '' }
  }
  if (locale === 'en') {
    return {
      year: String(d.getFullYear()),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      day: String(d.getDate()),
    }
  }
  return {
    year: `${d.getFullYear()}年`,
    month: `${d.getMonth() + 1}月`,
    day: String(d.getDate()),
  }
}

/**
 * The month label used by the archive pages: "2026年9月" / "September 2026".
 */
export function formatMonth(date: string, locale: string = 'ja'): string {
  const d = parseDateOnly(date)
  if (Number.isNaN(d.getTime())) return date
  if (locale === 'en') {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

/** "2026" — the year label used by the archive index. */
export function formatYear(date: string): string {
  const d = parseDateOnly(date)
  if (Number.isNaN(d.getTime())) return date
  return String(d.getFullYear())
}

/**
 * A stable, sortable key for grouping posts by month: "2026-09".
 * Computed from the LOCAL date so it always matches what the reader sees.
 */
export function monthKey(date: string): string {
  const d = parseDateOnly(date)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Truncate a summary at a word/character boundary and end it with an
 * ellipsis. The homepage used `line-clamp-2` which cut mid-sentence with
 * no ellipsis at all.
 */
export function truncate(text: string, maxLength: number): string {
  const clean = (text ?? '').trim()
  if (!clean) return ''
  if (clean.length <= maxLength) return clean
  const slice = clean.slice(0, maxLength)
  // Prefer to cut at the last punctuation/space so we do not slice a word
  // in half — but never lose more than 25% of the budget doing so.
  const minKeep = Math.floor(maxLength * 0.75)
  const candidates = [slice.lastIndexOf('。'), slice.lastIndexOf('、'), slice.lastIndexOf(' ')]
    .filter((i) => i >= minKeep)
    .sort((a, b) => b - a)
  const cut = candidates.length > 0 ? candidates[0] + 1 : maxLength
  return clean.slice(0, cut).trimEnd() + '…'
}
