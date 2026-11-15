// src/app/admin/drafts/page.tsx — Phase 2 (real data)
// /admin/drafts — all drafts (posts.status='draft', any collection)
import { PostsList } from '@/components/admin/PostsList';

export default function DraftsPage() {
  return <PostsList collection="drafts" title="草稿箱" showStatusFilter={false} />;
}
