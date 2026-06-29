'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// iOS Safari uses window.navigator.standalone to detect installed PWAs.
// (Android/Chrome use beforeinstallprompt; iOS has no equivalent.)
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // @ts-expect-error: non-standard
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [showIOSHelp, setShowIOSHelp] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isStandalone()) {
      setInstalled(true)
      return
    }
    // Already dismissed this session?
    if (sessionStorage.getItem('pwa-install-dismissed') === '1') {
      setDismissed(true)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed || dismissed) return null

  const triggerInstall = async () => {
    if (deferred) {
      await deferred.prompt()
      const choice = await deferred.userChoice
      if (choice.outcome === 'accepted') {
        setInstalled(true)
      }
      setDeferred(null)
    } else if (isIOS()) {
      setShowIOSHelp(true)
    }
  }

  const dismiss = () => {
    setDismissed(true)
    sessionStorage.setItem('pwa-install-dismissed', '1')
  }

  return (
    <>
      {/* Floating install button */}
      <button
        onClick={triggerInstall}
        aria-label="Install Frank Ding as app"
        title="Install Frank Ding as app"
        className="pwa-install-btn"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 40,
          padding: '10px 16px',
          borderRadius: '9999px',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          color: '#ffffff',
          background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
          border: '1px solid rgba(59, 130, 246, 0.5)',
          boxShadow: '0 8px 24px rgba(59, 130, 246, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{ fontSize: '14px' }}>📲</span>
        <span>Install App</span>
      </button>

      {showIOSHelp && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowIOSHelp(false)}
          className="pwa-ios-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="pwa-ios-modal"
            style={{
              maxWidth: '380px',
              width: '100%',
              padding: '24px',
              borderRadius: '14px',
              fontFamily: 'var(--font-body)',
              color: '#e5e7eb',
              background: 'rgba(15, 23, 42, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#ffffff' }}>
              Install on iOS
            </h3>
            <ol style={{ paddingLeft: '20px', lineHeight: 1.7, fontSize: '14px' }}>
              <li>Tap the <strong>Share</strong> button (⎋ square with arrow).</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Confirm by tapping <strong>Add</strong>.</li>
            </ol>
            <button
              onClick={() => setShowIOSHelp(false)}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '10px',
                borderRadius: '10px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.85)',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                cursor: 'pointer',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {deferred && (
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="pwa-dismiss"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '156px',
            zIndex: 40,
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            fontFamily: 'var(--font-mono)',
            fontSize: '14px',
            lineHeight: 1,
            color: 'rgba(255, 255, 255, 0.6)',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      )}
    </>
  )
}