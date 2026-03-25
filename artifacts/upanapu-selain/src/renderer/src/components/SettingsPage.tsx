import { useState } from 'react'
import { X, Save, Home, GraduationCap, Type, Globe } from 'lucide-react'
import type { Settings } from '../types'

interface SettingsPageProps {
  settings: Settings
  onSave: (settings: Settings) => void
  onClose: () => void
}

export default function SettingsPage({ settings, onSave, onClose }: SettingsPageProps) {
  const [homeUrl, setHomeUrl] = useState(settings.homeUrl)
  const [tutorMode, setTutorMode] = useState(settings.tutorMode)
  const [fontSize, setFontSize] = useState<Settings['fontSize']>(settings.fontSize)

  function handleSave() {
    onSave({ homeUrl, tutorMode, fontSize })
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(10, 20, 28, 0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(6px)',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--color-primary)',
          borderRadius: 20,
          border: '2px solid rgba(8,102,255,0.3)',
          padding: 36,
          minWidth: 480,
          maxWidth: 560,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#0866FF' }}>⚙</span> Asetukset
          </h2>
          <button
            onClick={onClose}
            title="Sulje asetukset"
            aria-label="Sulje asetukset"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 8,
              color: '#FFFFFF',
              width: 40,
              height: 40,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Home URL */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, color: '#FFFFFF', fontWeight: 600, marginBottom: 8 }}>
            <Home size={18} style={{ color: '#0866FF' }} />
            Kotisivu
          </label>
          <p style={{ fontSize: 14, color: '#A8C0CC', marginBottom: 8 }}>
            Tämä sivu avautuu kun painat Kotisivu-painiketta tai käynnistät ohjelman.
          </p>
          <div style={{ position: 'relative' }}>
            <Globe size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#A8C0CC' }} />
            <input
              type="text"
              value={homeUrl}
              onChange={e => setHomeUrl(e.target.value)}
              placeholder="https://www.google.fi"
              aria-label="Kotisivun osoite"
              style={{
                width: '100%',
                padding: '14px 14px 14px 36px',
                borderRadius: 10,
                border: '2px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.08)',
                color: '#FFFFFF',
                fontSize: 16,
                fontFamily: 'inherit',
                outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = '#0866FF')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
            />
          </div>
        </div>

        {/* Tutor Mode */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, color: '#FFFFFF', fontWeight: 600, marginBottom: 4 }}>
                <GraduationCap size={18} style={{ color: '#FFD700' }} />
                Opastus-tila
              </label>
              <p style={{ fontSize: 14, color: '#A8C0CC' }}>
                Näyttää selityksiä jokaisen painikkeen alla.
              </p>
            </div>
            <button
              role="switch"
              aria-checked={tutorMode}
              onClick={() => setTutorMode(!tutorMode)}
              title={tutorMode ? 'Opastus on päällä — klikkaa poistaaksesi' : 'Opastus on pois — klikkaa laittaaksesi päälle'}
              style={{
                width: 64,
                height: 34,
                borderRadius: 17,
                background: tutorMode ? '#0866FF' : 'rgba(255,255,255,0.15)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s',
                border: 'none',
                flexShrink: 0,
              }}
            >
              <div style={{
                position: 'absolute',
                top: 3,
                left: tutorMode ? 33 : 3,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#FFFFFF',
                transition: 'left 0.2s',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>
        </div>

        {/* Font Size */}
        <div style={{ marginBottom: 32 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, color: '#FFFFFF', fontWeight: 600, marginBottom: 8 }}>
            <Type size={18} style={{ color: '#0866FF' }} />
            Tekstikoko
          </label>
          <p style={{ fontSize: 14, color: '#A8C0CC', marginBottom: 10 }}>
            Valitse sopiva tekstikoko.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            {([
              { value: 'normal', label: 'Normaali', size: '16px' },
              { value: 'large', label: 'Suuri', size: '18px' },
              { value: 'xlarge', label: 'Erittäin suuri', size: '22px' },
            ] as Array<{ value: Settings['fontSize']; label: string; size: string }>).map(opt => (
              <button
                key={opt.value}
                onClick={() => setFontSize(opt.value)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  borderRadius: 10,
                  border: `2px solid ${fontSize === opt.value ? '#0866FF' : 'rgba(255,255,255,0.15)'}`,
                  background: fontSize === opt.value ? 'rgba(8,102,255,0.2)' : 'rgba(255,255,255,0.05)',
                  color: fontSize === opt.value ? '#FFFFFF' : '#A8C0CC',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: opt.size, fontWeight: 700, marginBottom: 2 }}>A</div>
                <div style={{ fontSize: 13 }}>{opt.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 10,
              border: '2px solid rgba(255,255,255,0.2)',
              background: 'transparent',
              color: '#FFFFFF',
              fontSize: 17,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 600,
            }}
          >
            Peruuta
          </button>
          <button
            onClick={handleSave}
            style={{
              flex: 2,
              padding: '14px',
              borderRadius: 10,
              border: 'none',
              background: '#0866FF',
              color: '#FFFFFF',
              fontSize: 17,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 16px rgba(8,102,255,0.4)',
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#0550CC')}
            onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = '#0866FF')}
          >
            <Save size={18} />
            Tallenna asetukset
          </button>
        </div>

        {/* Brand footer */}
        <div style={{ marginTop: 24, textAlign: 'center', color: '#A8C0CC', fontSize: 13 }}>
          Upa'n Apu Selain · <a
            href="#"
            onClick={e => { e.preventDefault(); window.electronAPI?.navigate('https://upanapu.com') }}
            style={{ color: '#0866FF', textDecoration: 'none' }}
          >
            upanapu.com
          </a> · Antti Keränen · 040 3257025
        </div>
      </div>
    </div>
  )
}
