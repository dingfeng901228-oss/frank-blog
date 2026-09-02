// admin/src/lib/cms/types.ts
// Slim subset of src/lib/cms/types.ts — only what's used by admin SPA
// (Main project types.ts imports @cloudflare/workers-types which admin doesn't need)

export type Locale = 'zh' | 'ja' | 'en';
export type PostCollection = 'posts' | 'notes';
export type PostStatus = 'draft' | 'published' | 'archived';