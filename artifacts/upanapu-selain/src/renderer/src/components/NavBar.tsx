import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, Home, RotateCw, Settings, X, GraduationCap } from 'lucide-react'

interface NavBarProps {
  currentUrl: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  tutorMode: boolean
  onOpenSettings: () => void
}

interface NavButtonProps {
  onClick: () => void
  disabled?: boolean
  title: string
  tutorHint?: string
  tutorMode: boolean
  icon: React.ReactNode
  'aria-label': string
}

function NavButton({ onClick, disabled, title, tutorHint, tutorMode, icon, 'aria-label': ariaLabel }: NavButtonProps) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: tutorMode ? 68 : 52 }}>
      <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        className="flex items-center justify-center rounded-lg transition-all duration-150"
        style={{
          width: 52,
          height: 52,
          background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)',
          color: disabled ? 'rgba(255,255,255,0.3)' : '#FFFFFF',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 22,
          borderRadius: 10,
        }}
        onMouseEnter={e => {
          if (!disabled) {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.22)'
          }
        }}
        onMouseLeave={e => {
          if (!disabled) {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)'
          }
        }}
      >
        {icon}
      </button>
      {tutorMode && tutorHint && (
        <span className="tutor-hint" style={{ maxWidth: 72 }}>{tutorHint}</span>
      )}
    </div>
  )
}

export default function NavBar({
  currentUrl,
  isLoading,
  canGoBack,
  canGoForward,
  tutorMode,
  onOpenSettings
}: NavBarProps) {
  const [inputValue, setInputValue] = useState(currentUrl)
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!inputFocused) {
      setInputValue(currentUrl)
    }
  }, [currentUrl, inputFocused])

  function handleNavigate(e?: FormEvent) {
    e?.preventDefault()
    if (inputValue.trim()) {
      window.electronAPI?.navigate(inputValue.trim())
      inputRef.current?.blur()
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setInputValue(currentUrl)
      inputRef.current?.blur()
    }
  }

  function handleInputFocus() {
    setInputFocused(true)
    setTimeout(() => inputRef.current?.select(), 10)
  }

  function handleInputBlur() {
    setInputFocused(false)
    setInputValue(currentUrl)
  }

  const displayUrl = inputFocused
    ? inputValue
    : currentUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') || inputValue

  return (
    <div
      style={{
        height: 'var(--toolbar-height)',
        background: 'linear-gradient(180deg, var(--color-primary-dark) 0%, var(--color-primary) 100%)',
        borderBottom: '2px solid rgba(8,102,255,0.4)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 12px',
        gap: 0,
        position: 'relative',
        flexShrink: 0,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          WebkitAppRegion: 'no-drag',
        } as React.CSSProperties}
      >
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 4, flexShrink: 0 }}>
          <a
            href="https://upanapu.com"
            onClick={e => { e.preventDefault(); window.electronAPI?.navigate('https://upanapu.com') }}
            style={{ textDecoration: 'none', cursor: 'pointer' }}
            title="Upa'n Apu — upanapu.com"
          >
            <span style={{
              fontWeight: 900,
              fontSize: 20,
              letterSpacing: '-0.5px',
              color: '#0866FF',
              textShadow: '0 1px 4px rgba(8,102,255,0.5)',
              lineHeight: 1,
            }}>
              Upa'n<span style={{ color: '#FFFFFF' }}>Apu</span>
            </span>
          </a>
          {tutorMode && (
            <span className="tutor-hint" style={{ color: '#A8C0CC', fontSize: 9 }}>selain</span>
          )}
        </div>

        <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.15)', margin: '0 4px', flexShrink: 0 }} />

        {/* Back button */}
        <NavButton
          onClick={() => window.electronAPI?.goBack()}
          disabled={!canGoBack}
          title="Takaisin"
          tutorHint="Edellinen"
          tutorMode={tutorMode}
          aria-label="Takaisin edelliselle sivulle"
          icon={<ChevronLeft size={24} />}
        />

        {/* Forward button */}
        <NavButton
          onClick={() => window.electronAPI?.goForward()}
          disabled={!canGoForward}
          title="Eteenpäin"
          tutorHint="Seuraava"
          tutorMode={tutorMode}
          aria-label="Eteenpäin seuraavalle sivulle"
          icon={<ChevronRight size={24} />}
        />

        {/* Reload/Stop button */}
        <NavButton
          onClick={() => window.electronAPI?.reload()}
          title={isLoading ? 'Lopeta lataus' : 'Lataa uudelleen'}
          tutorHint={isLoading ? 'Lopeta' : 'Päivitä'}
          tutorMode={tutorMode}
          aria-label="Lataa sivu uudelleen"
          icon={isLoading ? <X size={22} /> : <RotateCw size={20} />}
        />

        {/* Home button */}
        <NavButton
          onClick={() => window.electronAPI?.goHome()}
          title="Kotisivu"
          tutorHint="Kotisivu"
          tutorMode={tutorMode}
          aria-label="Mene kotisivulle"
          icon={<Home size={22} />}
        />

        {/* URL Bar */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <form onSubmit={handleNavigate} style={{ display: 'flex' }}>
            <input
              ref={inputRef}
              type="text"
              value={displayUrl}
              onChange={e => setInputValue(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              onKeyDown={handleKeyDown}
              placeholder="Kirjoita osoite tai hakusana..."
              aria-label="Nettisivun osoite"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              style={{
                flex: 1,
                height: 52,
                borderRadius: 10,
                border: inputFocused ? '2px solid #0866FF' : '2px solid rgba(255,255,255,0.15)',
                background: inputFocused ? '#FFFFFF' : 'rgba(255,255,255,0.1)',
                color: inputFocused ? '#1A2B38' : '#FFFFFF',
                padding: '0 16px',
                fontSize: 16,
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'all 0.15s',
              }}
            />
          </form>
          {tutorMode && (
            <span className="tutor-hint" style={{ paddingLeft: 8 }}>
              Kirjoita osoite (esim. google.fi) tai hakusana ja paina Enter
            </span>
          )}
        </div>

        <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.15)', margin: '0 4px', flexShrink: 0 }} />

        {/* Tutor mode indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            title={tutorMode ? 'Opastus päällä' : 'Opastus pois'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 8,
              background: tutorMode ? 'rgba(255,215,0,0.2)' : 'transparent',
              color: tutorMode ? '#FFD700' : 'rgba(255,255,255,0.4)',
            }}
          >
            <GraduationCap size={20} />
          </div>
          {tutorMode && (
            <span className="tutor-hint">Opastus</span>
          )}
        </div>

        {/* Settings button */}
        <NavButton
          onClick={onOpenSettings}
          title="Asetukset"
          tutorHint="Asetukset"
          tutorMode={tutorMode}
          aria-label="Avaa asetukset"
          icon={<Settings size={20} />}
        />
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'rgba(8,102,255,0.3)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            background: '#0866FF',
            animation: 'slide 1.5s infinite',
            width: '40%',
          }} />
        </div>
      )}

      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}
