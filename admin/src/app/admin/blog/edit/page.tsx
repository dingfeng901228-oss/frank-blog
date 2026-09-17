// admin/src/app/admin/blog/edit/page.tsx
// Edit an existing blog post — ?id= query param.
//
// Mount PostEditor directly (collection='posts') rather than re-exporting
// /admin/posts/edit, so each edit route owns its collection explicitly and
// a change to one route can't silently leak into the others.

'use client';

import { PostEditor } from '@/components/admin/PostEditor';

export default function BlogEditPage() {
  return <PostEditor collection="posts" />;
}
