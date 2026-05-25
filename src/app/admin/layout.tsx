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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0F' }}>
        <p style={{ fontFamily: 'monospace', fontSize: '13px', color: '#707080' }}>Loading...</p>
      </div>
    )
  }

  if (!authenticated) return null

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A0A0F' }}>
      {/* Admin Header */}
      <header style={{ borderBottom: '1px solid #1E1E2E', backgroundColor: '#1E1E2E' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <span style={{ fontFamily: 'serif', fontSize: '20px', fontWeight: 500, color: '#E8E8EC' }}>Admin</span>
            <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <Link href="/admin" style={{ fontSize: '13px', fontFamily: 'monospace', color: '#707080', textDecoration: 'none' }}>
                Posts
              </Link>
              <Link href="/admin/new" style={{ fontSize: '13px', fontFamily: 'monospace', color: '#707080', textDecoration: 'none' }}>
                New Post
              </Link>
            </nav>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem('admin_auth')
              router.push('/admin/login')
            }}
            style={{
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#707080',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px' }}>
        {children}
      </main>
    </div>
  )
}