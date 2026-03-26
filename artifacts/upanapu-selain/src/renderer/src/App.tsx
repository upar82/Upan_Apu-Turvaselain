import { useState, useEffect, useRef, useCallback } from 'react'
import NavBar from './components/NavBar'
import WelcomeScreen from './components/WelcomeScreen'
import { ScreenShare, type ScreenShareStatus } from './screen-share'
import type { Settings } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const API_BASE_URL: string = (import.meta as any).env?.['VITE_API_URL'] ?? 'https://upanapu-api.replit.app'

const DEFAULT_SETTINGS: Settings = {
  homeUrl: 'https://www.google.fi',
  tutorMode: true,
  fontSize: 'large',
  firstRun: true,
  blockPayments: false,
  deviceId: null,
  pairCode: null,
  syncEnabled: false
}

export default function App() {
  const [currentUrl, setCurrentUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [warning, setWarning] = useState<string | null>(null)
  const [portalMessage, setPortalMessage] = useState<string | null>(null)
  const [pairCode, setPairCode] = useState<string | null>(null)
  const [screenShareStatus, setScreenShareStatus] = useState<ScreenShareStatus>('idle')

  const screenShareRef = useRef<ScreenShare | null>(null)

  useEffect(() => {
    if (!window.electronAPI) return

    window.electronAPI.getSettings().then(s => {
      setSettings(s)
      if (s.pairCode) setPairCode(s.pairCode)
    })

    window.electronAPI.getDeviceStatus().then(status => {
      if (status.pairCode) setPairCode(status.pairCode)
    })

    const cleanups: Array<() => void> = []

    cleanups.push(window.electronAPI.onUrlChange(url => setCurrentUrl(url)))
    cleanups.push(window.electronAPI.onLoadingChange(loading => setIsLoading(loading)))
    cleanups.push(window.electronAPI.onCanNavigate((back, fwd) => {
      setCanGoBack(back)
      setCanGoForward(fwd)
    }))
    cleanups.push(window.electronAPI.onSettingsUpdated(s => {
      setSettings(s)
      if (s.pairCode) setPairCode(s.pairCode)
    }))
    cleanups.push(window.electronAPI.onWarning(w => setWarning(w)))
    if (window.electronAPI.onMessage) {
      cleanups.push(window.electronAPI.onMessage(msg => setPortalMessage(msg)))
    }

    return () => cleanups.forEach(fn => fn())
  }, [])

  // Start/stop screen share module when pairCode and firstRun state are ready
  useEffect(() => {
    const active = pairCode && !settings.firstRun

    if (!active) {
      if (screenShareRef.current) {
        screenShareRef.current.stop()
        screenShareRef.current = null
        setScreenShareStatus('idle')
      }
      return
    }

    if (screenShareRef.current) {
      screenShareRef.current.stop()
      screenShareRef.current = null
    }

    const ss = new ScreenShare({
      pairCode,
      apiBaseUrl: API_BASE_URL,
      onStatusChange: setScreenShareStatus,
    })
    ss.start()
    screenShareRef.current = ss

    return () => {
      ss.stop()
      screenShareRef.current = null
    }
  }, [pairCode, settings.firstRun])

  const handleWelcomeDone = useCallback((blockPayments: boolean) => {
    setSettings(prev => ({ ...prev, firstRun: false, blockPayments }))
  }, [])

  const handleDismissWarning = useCallback(() => {
    setWarning(null)
  }, [])

  const handleDismissPortalMessage = useCallback(() => {
    setPortalMessage(null)
    if (window.electronAPI?.clearMessage) {
      void window.electronAPI.clearMessage()
    }
  }, [])

  const fontClass =
    settings.fontSize === 'xlarge' ? 'font-xlarge' :
    settings.fontSize === 'large' ? 'font-large' :
    ''

  return (
    <div
      className={`flex flex-col h-full w-full ${fontClass}`}
      style={{ background: 'var(--color-primary-dark)' }}
    >
      <NavBar
        currentUrl={currentUrl}
        isLoading={isLoading}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        tutorMode={settings.tutorMode}
        warning={warning}
        onDismissWarning={handleDismissWarning}
        isStreaming={screenShareStatus === 'streaming'}
      />

      {settings.firstRun && (
        <WelcomeScreen
          settings={settings}
          pairCode={pairCode}
          onDone={handleWelcomeDone}
        />
      )}

      {portalMessage && (
        <div style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          maxWidth: 380,
          background: '#1a2b38',
          border: '2.5px solid #0866FF',
          borderRadius: 18,
          padding: '18px 22px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>🎓</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0866FF', marginBottom: 4 }}>
                Viesti omaiseltasi
              </div>
              <div style={{ fontSize: 15, color: '#FFFFFF', lineHeight: 1.55, wordBreak: 'break-word' }}>
                {portalMessage}
              </div>
            </div>
          </div>
          <button
            onClick={handleDismissPortalMessage}
            style={{
              alignSelf: 'flex-end',
              background: '#0866FF',
              border: 'none',
              borderRadius: 10,
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: 700,
              padding: '10px 20px',
              cursor: 'pointer',
            }}
          >
            ✓ Selvä, kiitos!
          </button>
        </div>
      )}
    </div>
  )
}
