// src/app/admin/notes/new/page.tsx — Phase 3
// /admin/notes/new — creates a new note (API collection='notes')
'use client';

import { PostEditor } from '@/components/admin/PostEditor';

export default function NewNotePage() {
  return <PostEditor collection="notes" />;
}
