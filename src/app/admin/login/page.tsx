'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ADMIN_PASSWORD = 'teihou'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', 'true')
      router.push('/admin')
    } else {
      setLoading(false)
      setError(true)
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0F', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '320px' }}>
        <h1 style={{ fontFamily: 'serif', fontSize: '28px', fontWeight: 500, textAlign: 'center', marginBottom: '8px', color: '#E8E8EC' }}>Admin</h1>
        <p style={{ textAlign: 'center', marginBottom: '40px', fontSize: '13px', fontFamily: 'monospace', color: '#707080' }}>
          blog.frank2025.com
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: '#1E1E2E',
                border: `1px solid ${error ? '#ef4444' : '#1E1E2E'}`,
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#E8E8EC',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {error && (
              <p style={{ color: '#ef4444', fontSize: '12px', fontFamily: 'monospace', marginTop: '8px' }}>
                Incorrect password
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#007a75' : '#00D4C8',
              color: '#0A0A0F',
              border: 'none',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}