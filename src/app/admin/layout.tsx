'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth')
    if (auth !== 'true') {
      router.replace('/admin/login')
    } else {
      setAuthenticated(true)
    }
    setChecking(false)
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-sm text-[var(--muted)]">Loading...</p>
      </div>
    )
  }

  if (!authenticated) return null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Admin Header */}
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-serif text-xl font-medium">Admin</span>
            <nav className="flex items-center gap-6 text-sm font-mono">
              <Link href="/admin" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                Posts
              </Link>
              <Link href="/admin/new" className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
                New Post
              </Link>
            </nav>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_auth')
              router.push('/admin/login')
            }}
            className="text-xs font-mono text-[var(--muted)] hover:text-red-400 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {children}
      </main>
    </div>
  )
}