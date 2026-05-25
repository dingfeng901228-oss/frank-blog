'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ADMIN_PASSWORD = 'teihou'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', 'true')
      router.push('/admin')
    } else {
      setError(true)
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-3xl font-medium mb-2 text-center">Admin</h1>
        <p className="text-[var(--muted)] text-sm text-center mb-10 font-mono">
          blog.frank2025.com
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={`w-full px-4 py-3 bg-[var(--surface)] border rounded-lg font-mono text-sm focus:outline-none focus:border-[var(--accent)] transition-colors ${
                error ? 'border-red-500' : 'border-[var(--border)]'
              }`}
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-xs font-mono mt-2">Incorrect password</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-[var(--accent)] text-white rounded-lg text-sm font-mono hover:opacity-90 transition-opacity"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}