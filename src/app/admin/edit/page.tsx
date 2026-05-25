'use client'

import PostEditor from '@/components/admin/PostEditor'
import { useSearchParams } from 'next/navigation'

export default function EditPostPage() {
  const searchParams = useSearchParams()
  const slug = searchParams.get('slug') || ''
  const locale = searchParams.get('locale') || 'ja'
  return <PostEditor mode="edit" initialSlug={slug} initialLocale={locale} />
}