// src/app/admin/notes/edit/page.tsx
// Alias for /admin/posts/edit — same editor (collection='notes'). Kept as a
// separate route per CMS V2 §二 URL convention:
//   /admin/notes/:id/edit
// (the real route uses ?id= since output: 'export' forbids dynamic segments).
'use client';

import EditPostPage from '../../posts/edit/page';

export default function NotesEditAlias() {
  return <EditPostPage />;
}
