// src/lib/cms/tags.ts
// The admin's tag rules.
//
// Item 5 — the editor's tag field was free text, so the same tag could
// be written three ways ("AI", " AI", "AI，日本語") and the tag page
// showed "共 0 个标签" because nothing ever populated the tag system.
//
// The rules below are the SAME rules the Worker applies
// (worker-api/src/tags.ts) and the same shape the public site uses
// (src/lib/tags.ts on the front end):
//
//   1. The tag's URL segment IS the tag name, encoded once:
//        /<locale>/<collection>/tag/<encodeURIComponent(name)>
//      The CMS stores that same string as the tag's slug, so a tag
//      created here has a working page on the public site.
//   2. A full-width comma (，) separates tags just like a half-width
//      one, because that is what a Japanese IME produces.
//   3. Every tag is trimmed.
//   4. The same tag never appears twice — not even in two spellings
//      that differ only in case.

/** The separators a human can type between tags. */
const TAG_INPUT_SEPARATORS = /[,，、]/;

/**
 * Split a tag that may actually be two tags joined together.
 *
 * The site used to carry the tag "AIエージェント.AI Agent" — two tags
 * joined by a period. When one of the parts is a tag the site already
 * knows, the join point is the period before it.
 */
export function splitJoinedTag(tag: string, known: Set<string>): string[] {
  const trimmed = tag.trim();
  if (!trimmed) return [];

  if (!known.has(trimmed)) {
    for (const candidate of known) {
      if (!candidate) continue;
      const index = trimmed.indexOf(candidate);
      if (index <= 0) continue;
      const head = trimmed.slice(0, index);
      const tail = trimmed.slice(index);
      // The character right before the known tag must be a joining
      // character, otherwise this is just a tag that contains another
      // tag's name.
      const sep = head.slice(-1);
      if (sep === '.' || sep === '・' || sep === '・') {
        return [head.slice(0, -1).trim(), tail.trim()].filter(Boolean);
      }
    }
  }

  return [trimmed];
}

/**
 * Turn the editor's free-text tag field into a canonical tag list.
 *
 * @param input the raw text from the tag field
 * @param known every tag the site already knows about
 */
export function normalizeTagInput(input: string, known: Set<string> = new Set()): string[] {
  if (!input || typeof input !== 'string') return [];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const rawPart of input.split(TAG_INPUT_SEPARATORS)) {
    const part = rawPart.trim().replace(/，/g, ',');
    if (!part) continue;
    for (const piece of splitJoinedTag(part, known)) {
      const name = piece.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }

  return out;
}

/**
 * The URL segment the public site uses for a tag.
 *
 * Kept here as well as in the Worker so the admin can show a preview
 * link that is guaranteed to match the generated page.
 */
export function tagPathSegment(name: string): string {
  return encodeURIComponent(name);
}
