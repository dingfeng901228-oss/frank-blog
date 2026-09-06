// src/app/admin/blog/edit/page.tsx
// Alias for /admin/posts/edit — same editor (collection-aware). The page reads
// ?id= and POSTs collection='posts' (handled by /admin/posts/edit). Kept as a
// separate route per CMS V2 §二 URL convention:
//   /admin/blog/:id/edit
//   /admin/notes/:id/edit
// (the real route uses ?id= since output: 'export' forbids dynamic segments).
'use client';

import EditPostPage from '../../posts/edit/page';

export default function BlogEditAlias() {
  return <EditPostPage />;
}
