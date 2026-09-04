// src/app/admin/notes/page.tsx — Phase 2 (real data)
// /admin/notes — list of notes (posts.collection='notes')
import { PostsList } from '@/components/admin/PostsList';

export default function NotesPage() {
  return (
    <PostsList
      title="Notes"
      defaultCollection="notes"
      newHref="/admin/posts/new"
      newLabel="+ New Note"
    />
  );
}
