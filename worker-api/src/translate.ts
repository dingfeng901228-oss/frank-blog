// worker-api/src/translate.ts
//
// Auto-translation for the CMS: when Frank publishes a Chinese post, the
// Worker generates the Japanese and English versions and publishes them
// alongside it.
//
// WHY A DEDICATED MODULE
// ----------------------
// Translating an MDX body naively (one big model call) loses structure:
// paragraphs get merged, blank lines disappear, code blocks get mangled,
// and image syntax breaks. So this module:
//
//   1. PROTECTS non-translatable spans (fenced code blocks, inline code,
//      images, links) behind placeholder markers before sending anything
//      to the model.
//   2. SPLITS the body into paragraph-aligned chunks small enough that the
//      model reliably keeps the paragraph count and the markdown intact.
//   3. TRANSLATES each chunk independently, in parallel.
//   4. RESTORES the protected spans verbatim.
//
// Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast on Workers AI. It was
// picked over the smaller models because it keeps Japanese です・ます調 and
// paragraph structure intact, and over m2m100 (the dedicated translation
// model) because m2m100 collapsed a 3.8k-char article into one paragraph.
// gpt-oss-120b was tested and is too slow (24s for 700 chars) and returned
// empty for this shape of prompt.

export type Locale = 'zh' | 'ja' | 'en';

import type { Env } from './cms';

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

// Private Use Area characters — safe to use as placeholder delimiters
// because they cannot appear in real content and survive JSON transport.
const MARK_OPEN = '\uE000';
const MARK_CLOSE = '\uE001';

// Chunk sizing. ~1800 chars of source per call keeps the paragraph count
// intact while keeping the number of parallel calls reasonable — a 4k-char
// article becomes ~3 chunks, so the whole publish (2 locales × 3 chunks)
// finishes in about 20 seconds. Larger chunks start losing paragraph
// boundaries; smaller ones multiply the call count.
const CHUNK_MAX_CHARS = 1800;
const CHUNK_MAX_PARAS = 16;

const LOCALE_NAMES: Record<Locale, string> = {
  zh: 'Simplified Chinese',
  ja: 'Japanese',
  en: 'English',
};

// ────────────────────────────────────────────────────
// Placeholder protection
// ────────────────────────────────────────────────────

const FENCED_CODE = /```[\s\S]*?```/g;
const INLINE_CODE = /`[^`\n]+`/g;
// The image TARGET (the URL) is protected, but the ALT TEXT is not — alt
// text is reader-visible prose ("测试封面" / "test cover") and should be
// translated like any other text. The pattern captures the URL so the
// placeholder can carry just that part.
const IMAGE_MARKUP = /!\[([^\]]*)\]\(([^)]*)\)/g;
const LINK_MARKUP = /(?<!!)\[([^\]]*)\]\(([^)]*)\)/g;

export interface Protected {
  text: string;
  store: string[];
}

export function protectSpans(text: string): Protected {
  const store: string[] = [];
  const push = (m: string) => {
    store.push(m);
    return `${MARK_OPEN}${store.length - 1}${MARK_CLOSE}`;
  };
  let out = text;
  // Order matters: fenced code first (it may contain backticks), then
  // inline code, then images, then links.
  out = out.replace(FENCED_CODE, push);
  out = out.replace(INLINE_CODE, push);
  // Images: keep the alt text in the flow, protect only the URL.
  out = out.replace(IMAGE_MARKUP, (_m, alt: string, url: string) => {
    store.push(url);
    return `![${alt}](${MARK_OPEN}${store.length - 1}${MARK_CLOSE})`;
  });
  // Links: keep the link text in the flow, protect only the target.
  out = out.replace(LINK_MARKUP, (_m, text: string, url: string) => {
    store.push(url);
    return `[${text}](${MARK_OPEN}${store.length - 1}${MARK_CLOSE})`;
  });
  return { text: out, store };
}

export function restoreSpans(text: string, store: string[]): string {
  let out = text;
  for (let i = 0; i < store.length; i++) {
    out = out.split(`${MARK_OPEN}${i}${MARK_CLOSE}`).join(store[i]);
  }
  // If the model dropped a marker anyway, strip the leftover marker
  // characters rather than shipping them to the reader.
  return out.replace(/[\uE000\uE001]/g, '');
}

// ────────────────────────────────────────────────────
// Chunking
// ────────────────────────────────────────────────────

export interface Chunk {
  index: number;
  text: string;
}

/**
 * Split protected text into chunks. Paragraphs (separated by blank lines)
 * are never split across chunks — that is what keeps the model from
 * merging them.
 */
export function chunkText(text: string): Chunk[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let currentLen = 0;

  const flush = () => {
    if (current.length === 0) return;
    chunks.push({ index: chunks.length, text: current.join('\n\n') });
    current = [];
    currentLen = 0;
  };

  for (const para of paragraphs) {
    const paraLen = para.length;
    // A single oversized paragraph (rare, but a long code block can do
    // it) becomes its own chunk rather than being split — the model can
    // handle it, and splitting it would corrupt the structure.
    if (currentLen > 0 && (currentLen + paraLen > CHUNK_MAX_CHARS || current.length >= CHUNK_MAX_PARAS)) {
      flush();
    }
    current.push(para);
    currentLen += paraLen + 2;
  }
  flush();

  return chunks;
}

// ────────────────────────────────────────────────────
// Model call
// ────────────────────────────────────────────────────

function systemPrompt(target: Locale, source: Locale): string {
  const targetName = LOCALE_NAMES[target];
  const sourceName = LOCALE_NAMES[source];
  return [
    `You are a professional translator. Translate the ${sourceName} text the user sends into natural, fluent ${targetName}.`,
    '',
    'Context: the text is a personal blog (technology, AI, life in Japan) written by a Chinese engineer who lives in Japan.',
    '',
    'Rules — follow ALL of them:',
    '1. Output ONLY the translation. No preamble, no explanation, no notes.',
    '2. Translate EVERY character of the source language. Do not leave any sentence untranslated, not even a short one inside quotes.',
    '3. Keep the SAME number of paragraphs as the input. Never merge two paragraphs, never split one. Keep blank lines exactly where they are.',
    '4. Preserve markdown syntax exactly: ## headings, **bold**, *italic*, - lists, 1. ordered lists, > blockquotes, | tables |, and horizontal rules.',
    '5. The markers N stand for URLs, inline code and code blocks. Reproduce each marker EXACTLY ONCE, in the correct position. Never translate a marker, never drop one, never duplicate one, never move one.',
    '6. Translate image ALT TEXT (the text inside ![ ]) too — it is reader-visible prose. But never touch the URL inside ( ).',
    '7. Keep these terms unchanged because they are the names of products and technologies: Gateway, Agent, AI, CI, CD, commit, rollback, Windows, GitHub, Hermes, OpenClaw, Python, JavaScript, TypeScript, R2, D1, API, MCP, RSS, PWA.',
    '8. Use natural punctuation for the target language. For Japanese use 、。「」 and です・ます調. For English use standard English punctuation.',
    '9. Do not add or remove content. Do not add a title. The first line of the source is already the first line of the translation.',
    `10. If you find yourself unable to translate a fragment, wrap that fragment in 【】 instead of copying it verbatim. For example: 【untranslatable】. This is rare and will be checked.`,
  ].join('\n');
}

/**
 * The model wraps anything it could not translate in 【】. Finding one means
 * the chunk has a hole in it, and the chunk should be retried with a
 * stronger nudge rather than shipped.
 */
const UNTRANSLATED_MARKER = /【[^】]*】/g;

function hasUntranslated(text: string): boolean {
  UNTRANSLATED_MARKER.lastIndex = 0;
  return UNTRANSLATED_MARKER.test(text);
}

/**
 * Remove the 【】 markers from a translation that will be shipped as-is.
 * The wrapped text stays in place (untranslated) but the reader does not
 * see stray brackets.
 */
function stripUntranslatedMarkers(text: string): string {
  return text.replace(/【([^】]*)】/g, '$1');
}

async function callModel(
  env: Env,
  system: string,
  user: string,
  maxTokens: number,
  temperature = 0.2
): Promise<string | null> {
  // The AI binding is optional in the Env type so the Worker still
  // type-checks if the binding is ever removed from wrangler.toml. Every
  // caller checks env.AI before reaching here.
  if (!env.AI) return null;
  try {
    const res: any = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature,
    });
    const text = res?.response;
    return typeof text === 'string' && text.trim().length > 0 ? text : null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────

export interface TranslateResult {
  text: string;
  ok: boolean;
  error?: string;
}

/**
 * Translate a plain (non-markdown) string — used for titles, descriptions
 * and tags. These are short so a single call is fine.
 */
export async function translatePlain(
  env: Env,
  text: string,
  source: Locale,
  target: Locale
): Promise<TranslateResult> {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return { text: '', ok: true };
  if (source === target) return { text, ok: true };

  const out = await callModel(
    env,
    systemPrompt(target, source),
    trimmed,
    2000
  );
  if (out === null) {
    return { text, ok: false, error: 'AI translation failed' };
  }
  return { text: out.trim(), ok: true };
}

/**
 * Translate an MDX body. Non-translatable spans are protected, the body
 * is chunked on paragraph boundaries, every chunk is translated in
 * parallel, and the protected spans are restored afterwards.
 */
export async function translateMarkdown(
  env: Env,
  markdown: string,
  source: Locale,
  target: Locale
): Promise<TranslateResult> {
  if (!markdown || !markdown.trim()) return { text: '', ok: true };
  if (source === target) return { text: markdown, ok: true };

  const { text: protectedText, store } = protectSpans(markdown);
  const chunks = chunkText(protectedText);
  if (chunks.length === 0) return { text: markdown, ok: true };

  const system = systemPrompt(target, source);
  // Budget tokens generously: Japanese output is typically ~1.4x the
  // source character count, and the model must not truncate.
  const perChunkMax = 4000;

  const translateOne = async (chunkText: string): Promise<string | null> => {
    let out = await callModel(env, system, chunkText, perChunkMax);
    if (out !== null && hasUntranslated(out)) {
      // The model admitted it could not translate a fragment. Retry once
      // with a harder instruction — a second attempt at a different
      // temperature usually closes the hole.
      const retry = await callModel(
        env,
        system +
          '\n\nIMPORTANT: your previous attempt left some text untranslated. Translate EVERY fragment, including short phrases inside parentheses or quotes. Do not use 【】 — translate everything.',
        chunkText,
        perChunkMax,
        0.5
      );
      if (retry !== null && !hasUntranslated(retry)) {
        out = retry;
      }
    }
    return out;
  };

  const results = await Promise.all(
    chunks.map(async (c) => {
      const translated = await translateOne(c.text);
      return { chunk: c, translated };
    })
  );

  const failures = results.filter((r) => r.translated === null);
  if (failures.length > 0) {
    // Partial failure: fall back to the original text for the chunks that
    // failed rather than shipping a half-translated article. The caller
    // decides whether to accept the partial result.
    const merged = results
      .map((r) => r.translated ?? r.chunk.text)
      .join('\n\n');
    return {
      text: restoreSpans(stripUntranslatedMarkers(merged), store),
      ok: false,
      error: `${failures.length}/${chunks.length} chunk(s) failed to translate`,
    };
  }

  const merged = results.map((r) => r.translated as string).join('\n\n');
  return {
    text: restoreSpans(stripUntranslatedMarkers(merged), store),
    ok: true,
  };
}

/**
 * Translate a list of short strings (tags) as a single call — they are
 * comma-separated in the prompt and split back out on the newline.
 */
export async function translateTags(
  env: Env,
  tags: string[],
  source: Locale,
  target: Locale
): Promise<TranslateResult> {
  const list = tags.filter((t) => typeof t === 'string' && t.trim());
  if (list.length === 0) return { text: '', ok: true };
  if (source === target) return { text: list.join('\n'), ok: true };

  const numbered = list.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const prompt = [
    'Translate each numbered tag into the target language.',
    'Output exactly one tag per line, in the same order, with the number prefix removed.',
    'Keep tags short (1-3 words). Do not add punctuation or explanations.',
    '',
    numbered,
  ].join('\n');

  const out = await callModel(
    env,
    systemPrompt(target, source) + '\n9. The input is a numbered list of tags. Output the translated tags as a plain newline-separated list, no numbering.',
    prompt,
    1000
  );
  if (out === null) {
    return { text: list.join('\n'), ok: false, error: 'AI tag translation failed' };
  }
  const lines = out
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
  // If the model returned a different count, keep the original tags rather
  // than silently dropping some.
  if (lines.length !== list.length) {
    return { text: list.join('\n'), ok: false, error: 'Tag count mismatch' };
  }
  return { text: lines.join('\n'), ok: true };
}
