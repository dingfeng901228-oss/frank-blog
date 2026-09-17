// admin/src/app/admin/notes/edit/page.tsx
// Edit an existing note — ?id= query param.
//
// NOTE: this used to `import EditPostPage from '../../posts/edit/page'`,
// which hardcodes collection='posts'. Every note opened through this route
// therefore reported itself as a blog post (wrong sidebar link, wrong
// "new" label, and — before the fix — a broken locale lookup). Mount
// PostEditor directly with collection='notes' instead of re-exporting the
// blog edit page.

'use client';

import { PostEditor } from '@/components/admin/PostEditor';

export default function NotesEditPage() {
  return <PostEditor collection="notes" />;
}
