import { useState, useEffect, useCallback } from 'react'
import NavBar from './components/NavBar'
import WelcomeScreen from './components/WelcomeScreen'
import type { Settings } from './types'

const DEFAULT_SETTINGS: Settings = {
  homeUrl: 'https://www.google.fi',
  tutorMode: true,
  fontSize: 'large',
  firstRun: true,
  blockPayments: false
}

export default function App() {
  const [currentUrl, setCurrentUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    if (!window.electronAPI) return

    window.electronAPI.getSettings().then(s => setSettings(s))

    const cleanups: Array<() => void> = []

    cleanups.push(window.electronAPI.onUrlChange(url => setCurrentUrl(url)))
    cleanups.push(window.electronAPI.onLoadingChange(loading => setIsLoading(loading)))
    cleanups.push(window.electronAPI.onCanNavigate((back, fwd) => {
      setCanGoBack(back)
      setCanGoForward(fwd)
    }))
    cleanups.push(window.electronAPI.onSettingsUpdated(s => setSettings(s)))
    cleanups.push(window.electronAPI.onWarning(w => setWarning(w)))

    return () => cleanups.forEach(fn => fn())
  }, [])

  const handleWelcomeDone = useCallback((blockPayments: boolean) => {
    setSettings(prev => ({ ...prev, firstRun: false, blockPayments }))
  }, [])

  const handleDismissWarning = useCallback(() => {
    setWarning(null)
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
      />

      {settings.firstRun && (
        <WelcomeScreen
          settings={settings}
          onDone={handleWelcomeDone}
        />
      )}
    </div>
  )
}
