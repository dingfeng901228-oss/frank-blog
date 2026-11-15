// Temp: scan all locales for stray non-CJK scripts (Devanagari, Cyrillic, etc.)
// in the blog content. Not part of the build.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'F:/WebSite/frank-blog-live/src/content'

const SCRIPTS = {
  Devanagari: /[ऀ-ॿ]/,
  Cyrillic: /[Ѐ-ӿ]/,
  Hangul: /[가-힯ᄀ-ᇿ]/,
  Thai: /[฀-๿]/,
  Arabic: /[؀-ۿ]/,
  Hebrew: /[֐-׿]/,
  Greek: /[Ͱ-Ͽ]/,
}

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(mdx|md)$/.test(f)) out.push(p)
  }
  return out
}

let hits = 0
for (const file of walk(ROOT)) {
  const rel = file.replace(ROOT.replace(/\\/g, '/') + '/', '')
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const [name, re] of Object.entries(SCRIPTS)) {
      if (re.test(line)) {
        console.log(`${rel}:${i + 1}  [${name}]  ${line.trim().slice(0, 160)}`)
        hits++
      }
    }
  })
}
console.log('\nTOTAL stray-script hits:', hits)
