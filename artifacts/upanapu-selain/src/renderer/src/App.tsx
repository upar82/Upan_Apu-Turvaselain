import { useState, useEffect, useCallback } from 'react'
import NavBar from './components/NavBar'
import SettingsPage from './components/SettingsPage'
import type { Settings } from './types'
import './types'

const DEFAULT_SETTINGS: Settings = {
  homeUrl: 'https://www.google.fi',
  tutorMode: true,
  fontSize: 'large'
}

export default function App() {
  const [currentUrl, setCurrentUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)

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

    return () => cleanups.forEach(fn => fn())
  }, [])

  const handleSaveSettings = useCallback(async (newSettings: Settings) => {
    await window.electronAPI?.updateSettings(newSettings)
    setSettings(newSettings)
    setShowSettings(false)
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
        onOpenSettings={() => setShowSettings(true)}
      />

      {showSettings && (
        <SettingsPage
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
