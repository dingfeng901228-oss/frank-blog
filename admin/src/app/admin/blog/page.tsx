// src/app/admin/blog/page.tsx — Phase 2 placeholder (Phase 1c routing)
import { PlaceholderPage } from '@/components/PlaceholderPage';

export default function BlogPage() {
  return (
    <PlaceholderPage
      title="Blog"
      phase="Phase 2 — Content Architecture"
      description="Blog list view — separate from Notes via posts.collection='blog'. Will list all blog posts with filters (locale, status, category), search, pagination, and per-row actions (Edit / Preview / Publish / Unpublish / Delete)."
    />
  );
}
