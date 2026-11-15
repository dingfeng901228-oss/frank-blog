'use client'

/**
 * ShareBar — X (Twitter) share + copy-link, shown at the bottom of an
 * article next to the related-posts block.
 *
 * The X share URL is a plain intent link, so it works without any
 * third-party script. The copy button uses the clipboard API and falls
 * back to a hidden textarea for browsers that block it (non-secure
 * contexts, older Safari).
 */

import { useState } from 'react'

const labels = {
  ja: { share: '共有', copy: 'リンクをコピー', copied: 'コピーしました' },
  zh: { share: '分享', copy: '复制链接', copied: '已复制' },
  en: { share: 'Share', copy: 'Copy link', copied: 'Copied' },
} as const

type ShareLabels = (typeof labels)[keyof typeof labels]

export default function ShareBar({
  locale,
  title,
  url,
}: {
  locale: string
  title: string
  url: string
}) {
  const [copied, setCopied] = useState(false)
  const t = (labels as Record<string, ShareLabels>)[locale] ?? labels.ja

  const xUrl = `https://x.com/intent/post?text=${encodeURIComponent(
    title
  )}&url=${encodeURIComponent(url)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // Fallback for browsers/contexts where the clipboard API is blocked.
      const ta = document.createElement('textarea')
      ta.value = url
      ta.setAttribute('readonly', '')
      ta.style.position = 'absolute'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        // Nothing more we can do — the link is still visible in the URL bar.
      }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const btnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 13px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.03)',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    textDecoration: 'none',
    transition: 'border-color 0.15s, color 0.15s',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.35)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {t.share}
      </span>

      <a href={xUrl} target="_blank" rel="noopener noreferrer" style={btnStyle}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span>X</span>
      </a>

      <button type="button" onClick={copyLink} style={btnStyle}>
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span>{copied ? t.copied : t.copy}</span>
      </button>
    </div>
  )
}
