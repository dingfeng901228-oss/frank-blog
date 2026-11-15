// src/app/admin/notes/page.tsx — Phase 2 (real data)
// /admin/notes — list of notes (posts.collection='notes')
//
// Item 11 — the page title is Chinese: "Notes" → "随笔".
import { PostsList } from '@/components/admin/PostsList';

export default function NotesPage() {
  return <PostsList collection="notes" title="随笔" />;
}
