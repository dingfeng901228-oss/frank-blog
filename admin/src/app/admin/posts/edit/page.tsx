// admin/src/app/admin/posts/edit/page.tsx
// Edit existing post — uses ?id= query param (Phase 11d). Mounts the shared
// PostEditor with collection='posts'; the editor self-fetches the row
// from ?id= on mount and reuses the same form, autosave, revisions, cover-
// picker, media-library insert, and locale-switch logic as the new-post
// pages.
//
// This used to host an 800-line EditPostInner with its own form state;
// it was deleted when the new PostEditor reached feature parity (the
// earlier code path skipped every PostEditor improvement since Phase 6).

'use client';

import { PostEditor } from '@/components/admin/PostEditor';

export default function EditPostPage() {
  return <PostEditor collection="posts" />;
}
