// src/app/admin/blog/new/page.tsx — Phase 3
// /admin/blog/new — creates a new blog article (API collection='posts')
'use client';

import { PostEditor } from '@/components/admin/PostEditor';

export default function NewBlogPostPage() {
  return <PostEditor collection="posts" />;
}
