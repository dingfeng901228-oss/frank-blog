'use client'

import { useEffect } from 'react'

// Register /sw.js (manually-written vanilla service worker) in production only.
// Dev mode skips registration to keep HMR snappy.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Trigger update check on every page load so users get the new SW promptly.
          try {
            reg.update()
          } catch (_) {
            // ignore
          }
        })
        .catch((err) => {
          console.warn('[PWA] SW registration failed:', err)
        })
    }

    if (document.readyState === 'complete') {
      onLoad()
    } else {
      window.addEventListener('load', onLoad, { once: true })
    }
  }, [])

  return null
}