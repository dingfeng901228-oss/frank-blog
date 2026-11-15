/**
 * The search page copy, shared by the server shell and the client-side
 * results component.
 *
 * It lives in its own module because a file with "use client" cannot import
 * a server component, and the page itself needs the strings for its
 * metadata while the results component needs them for rendering.
 */
export const copy = {
  ja: {
    title: 'サイト内検索',
    description: '記事とノートをタイトル・概要・タグから検索できます。',
    placeholder: '検索キーワードを入力…',
    search: '検索',
    resultsFor: (q: string) => `「${q}」の検索結果`,
    resultsForTag: (tag: string) => `タグ「${tag}」の記事`,
    count: (n: number) => `${n} 件`,
    empty: '該当する記事が見つかりませんでした。',
    all: 'すべての記事とノート',
    post: '記事',
    note: 'ノート',
  },
  zh: {
    title: '站内搜索',
    description: '按标题、摘要、标签搜索文章和随笔。',
    placeholder: '输入搜索关键词…',
    search: '搜索',
    resultsFor: (q: string) => `“${q}” 的搜索结果`,
    resultsForTag: (tag: string) => `标签 “${tag}” 的文章`,
    count: (n: number) => `${n} 篇`,
    empty: '没有找到匹配的文章。',
    all: '所有文章和随笔',
    post: '文章',
    note: '随笔',
  },
  en: {
    title: 'Search',
    description: 'Search posts and notes by title, summary, or tag.',
    placeholder: 'Type to search…',
    search: 'Search',
    resultsFor: (q: string) => `Results for “${q}”`,
    resultsForTag: (tag: string) => `Posts tagged “${tag}”`,
    count: (n: number) => `${n}`,
    empty: 'Nothing matched your search.',
    all: 'All posts and notes',
    post: 'Post',
    note: 'Note',
  },
} as const

export type Copy = typeof copy
