import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, Home, RotateCw, X, GraduationCap } from 'lucide-react'
import logoUrl from '../assets/upanapu-logo.png'

interface NavBarProps {
  currentUrl: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  tutorMode: boolean
  warning: string | null
  onDismissWarning: () => void
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
        className="flex items-center justify-center rounded-lg"
        style={{
          width: 52,
          height: 52,
          background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.12)',
          color: disabled ? 'rgba(255,255,255,0.3)' : '#FFFFFF',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontSize: 22,
          borderRadius: 10,
          transition: 'background 0.15s',
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

function TutorBubble({ message, onClose }: { message: string; onClose: () => void }) {
  const isPayment = message.includes('maksu') || message.includes('ostossivulta')
  const borderColor = isPayment ? '#FFD700' : '#FF6B35'
  const emoji = isPayment ? '🛡️' : '⚠️'

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'absolute',
        top: 'calc(100% + 10px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        background: '#1A2B38',
        border: `2px solid ${borderColor}`,
        borderRadius: 16,
        padding: '16px 20px',
        minWidth: 340,
        maxWidth: 520,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
      }}
    >
      <div aria-hidden="true" style={{
        position: 'absolute',
        top: -11,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0,
        height: 0,
        borderLeft: '10px solid transparent',
        borderRight: '10px solid transparent',
        borderBottom: `10px solid ${borderColor}`,
      }} />

      <div aria-hidden="true" style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'rgba(255,215,0,0.15)',
        border: '2px solid #FFD700',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        flexShrink: 0,
      }}>
        🎓
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span aria-hidden="true" style={{ fontSize: 18 }}>{emoji}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#FFD700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tutor huomauttaa
          </span>
        </div>
        <p style={{
          fontSize: 16,
          color: '#FFFFFF',
          lineHeight: 1.5,
          margin: 0,
          fontWeight: 500,
        }}>
          {message}
        </p>
      </div>

      <button
        onClick={onClose}
        title="Sulje varoitus"
        aria-label="Sulje varoitus"
        style={{
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: 8,
          color: '#FFFFFF',
          width: 32,
          height: 32,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.2)')}
        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)')}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  )
}

export default function NavBar({
  currentUrl,
  isLoading,
  canGoBack,
  canGoForward,
  tutorMode,
  warning,
  onDismissWarning,
}: NavBarProps) {
  const [inputValue, setInputValue] = useState(currentUrl)
  const [inputFocused, setInputFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!inputFocused) {
      setInputValue(currentUrl)
    }
  }, [currentUrl, inputFocused])

  useEffect(() => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    if (warning) {
      dismissTimerRef.current = setTimeout(() => {
        onDismissWarning()
      }, 10000)
    }
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    }
  }, [warning, onDismissWarning])

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
    <>
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
              href="https://www.upanapu.com"
              onClick={e => { e.preventDefault(); window.electronAPI?.navigate('https://www.upanapu.com') }}
              style={{ textDecoration: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Avaa upanapu.com"
              aria-label="Upan Apu — avaa upanapu.com"
            >
              <img
                src={logoUrl}
                alt="Upan Apu"
                style={{ height: 60, width: 'auto' }}
              />
            </a>
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
            icon={<ChevronLeft size={24} aria-hidden="true" />}
          />

          {/* Forward button */}
          <NavButton
            onClick={() => window.electronAPI?.goForward()}
            disabled={!canGoForward}
            title="Eteenpäin"
            tutorHint="Seuraava"
            tutorMode={tutorMode}
            aria-label="Eteenpäin seuraavalle sivulle"
            icon={<ChevronRight size={24} aria-hidden="true" />}
          />

          {/* Reload/Stop button */}
          <NavButton
            onClick={() => window.electronAPI?.reload()}
            title={isLoading ? 'Lopeta lataus' : 'Lataa uudelleen'}
            tutorHint={isLoading ? 'Lopeta' : 'Päivitä'}
            tutorMode={tutorMode}
            aria-label="Lataa sivu uudelleen"
            icon={isLoading ? <X size={22} aria-hidden="true" /> : <RotateCw size={20} aria-hidden="true" />}
          />

          {/* Home button */}
          <NavButton
            onClick={() => window.electronAPI?.goHome()}
            title="Kotisivu"
            tutorHint="Kotisivu"
            tutorMode={tutorMode}
            aria-label="Mene kotisivulle"
            icon={<Home size={22} aria-hidden="true" />}
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
                placeholder="Kirjoita osoite tai hakusana…"
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
                  transition: 'border-color 0.15s, background 0.15s, color 0.15s',
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
              aria-label={tutorMode ? 'Opastus päällä' : 'Opastus pois'}
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
              <GraduationCap size={20} aria-hidden="true" />
            </div>
            {tutorMode && (
              <span className="tutor-hint">Opastus</span>
            )}
          </div>

        </div>

        {/* Tutor speech bubble warning */}
        {warning && (
          <TutorBubble message={warning} onClose={onDismissWarning} />
        )}

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

    </>
  )
}
