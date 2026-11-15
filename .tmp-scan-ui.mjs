// Temp: find Chinese (simplified-only) characters leaking into the ja UI strings.
// Not part of the build.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'F:/WebSite/frank-blog-live/src'

function collect(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) collect(p, out)
    else if (/\.(tsx?|jsx?)$/.test(f)) out.push(p)
  }
  return out
}

function corpusChars(locale) {
  const dir = join(ROOT, 'content', locale)
  const set = new Set()
  const walk = (d) => {
    if (!statSync(d).isDirectory?.() && false) return
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(mdx|md)$/.test(f)) for (const c of readFileSync(p, 'utf8')) set.add(c)
    }
  }
  walk(dir)
  return set
}

const zh = corpusChars('zh')
const ja = corpusChars('ja')
const leak = new Set([...zh].filter((c) => !ja.has(c) && /[㐀-鿿]/.test(c)))

// Also the shared kanji that read wrong in Japanese.
const shared = ['随笔', '文章', '精选', '笔记', '标签', '搜索', '归档', '首页', '评论', '分享', '复制', '成长', '青岛', '写作', '舍得', '通关', '马强', '父母', '生涯']

const files = collect(ROOT).filter((f) => !f.includes(join('content')))
let hits = 0
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    const leakChars = [...line].filter((c) => leak.has(c))
    const sharedHit = shared.filter((s) => line.includes(s))
    if (leakChars.length || sharedHit.length) {
      console.log(`${f.replace(ROOT + '/', '')}:${i + 1}  ${line.trim().slice(0, 130)}`)
      hits++
    }
  })
}
console.log('\nUI leak hits:', hits)
