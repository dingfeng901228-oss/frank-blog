'use client'

/**
 * BackToTop — a floating button that appears once the reader has
 * scrolled past one viewport, and returns them to the top of the page.
 *
 * It is mounted once, in the locale layout, so it works on every page
 * (home, lists, article pages, archives, search).
 */

import { useEffect, useState } from 'react'

export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    function onScroll() {
      // One viewport height is the threshold: before that the page is
      // short enough that the button would cover content the reader is
      // still working through.
      setVisible(window.scrollY > window.innerHeight * 0.8)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      title="Back to top"
      className="fixed bottom-6 right-5 md:right-8 z-40 flex items-center justify-center rounded-full transition-all duration-300"
      style={{
        width: 42,
        height: 42,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transform: visible ? 'translateY(0)' : 'translateY(10px)',
        background: 'rgba(12, 16, 36, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        color: 'rgba(255, 255, 255, 0.75)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
      }}
    >
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 15 12 9 18 15" />
      </svg>
    </button>
  )
}
