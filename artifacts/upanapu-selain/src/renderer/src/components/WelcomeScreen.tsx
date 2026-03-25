import { useState } from 'react'
import type { Settings } from '../types'

interface WelcomeScreenProps {
  settings: Settings
  onDone: (blockPayments: boolean) => void
}

export default function WelcomeScreen({ settings, onDone }: WelcomeScreenProps) {
  const [chosen, setChosen] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleChoice(block: boolean) {
    if (saving) return
    setChosen(block)
    setSaving(true)
    const newSettings: Settings = {
      ...settings,
      blockPayments: block,
      firstRun: false
    }
    await window.electronAPI?.updateSettings(newSettings)
    onDone(block)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'linear-gradient(160deg, #0D1B26 0%, #1A2B38 60%, #0D1B26 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div style={{ maxWidth: 600, width: '100%', textAlign: 'center' }}>

        {/* Logo / Brand */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            fontWeight: 900,
            fontSize: 36,
            letterSpacing: '-1px',
            color: '#0866FF',
            textShadow: '0 2px 12px rgba(8,102,255,0.5)',
            lineHeight: 1,
          }}>
            Upa'n<span style={{ color: '#FFFFFF' }}>Apu</span>
          </div>
          <div style={{ color: '#A8C0CC', fontSize: 16, marginTop: 6 }}>
            Turvallinen selain
          </div>
        </div>

        {/* Tutor mascot speech */}
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          border: '2px solid rgba(8,102,255,0.3)',
          borderRadius: 20,
          padding: '32px 36px',
          marginBottom: 36,
        }}>
          {/* Tutor icon */}
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(255,215,0,0.15)',
            border: '3px solid #FFD700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: 32,
          }}>
            🎓
          </div>

          <h1 style={{
            fontSize: 26,
            fontWeight: 800,
            color: '#FFFFFF',
            marginBottom: 16,
            lineHeight: 1.3,
          }}>
            Tervetuloa Upa'n Apu -selaimeen!
          </h1>

          <p style={{
            fontSize: 19,
            color: '#D0E4EE',
            lineHeight: 1.6,
            marginBottom: 28,
          }}>
            Ennen kuin aloitat, minulla on yksi tärkeä kysymys.
          </p>

          <div style={{
            background: 'rgba(8,102,255,0.12)',
            border: '2px solid rgba(8,102,255,0.4)',
            borderRadius: 14,
            padding: '20px 24px',
            marginBottom: 12,
          }}>
            <p style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#FFFFFF',
              lineHeight: 1.4,
              margin: 0,
            }}>
              Haluatko estää verkko-ostokset?
            </p>
            <p style={{
              fontSize: 16,
              color: '#A8C0CC',
              marginTop: 8,
              marginBottom: 0,
              lineHeight: 1.5,
            }}>
              Jos valitset Kyllä, selain varoittaa sinua maksu- ja ostossivuilla.
              Voit silti jatkaa halutessasi.
            </p>
          </div>
        </div>

        {/* Choice buttons */}
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
          <button
            onClick={() => handleChoice(true)}
            disabled={saving}
            style={{
              flex: 1,
              maxWidth: 240,
              padding: '22px 16px',
              borderRadius: 16,
              border: chosen === true ? '3px solid #FFD700' : '3px solid rgba(255,255,255,0.2)',
              background: chosen === true ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.08)',
              color: '#FFFFFF',
              fontSize: 22,
              fontWeight: 800,
              cursor: saving ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseEnter={e => {
              if (!saving) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,215,0,0.12)'
            }}
            onMouseLeave={e => {
              if (!saving && chosen !== true) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
            }}
          >
            <span style={{ fontSize: 36 }}>🛡️</span>
            Kyllä, estä ostokset
            <span style={{ fontSize: 14, fontWeight: 400, color: '#A8C0CC' }}>Varoitus maksu­sivuilla</span>
          </button>

          <button
            onClick={() => handleChoice(false)}
            disabled={saving}
            style={{
              flex: 1,
              maxWidth: 240,
              padding: '22px 16px',
              borderRadius: 16,
              border: chosen === false ? '3px solid #0866FF' : '3px solid rgba(255,255,255,0.2)',
              background: chosen === false ? 'rgba(8,102,255,0.2)' : 'rgba(255,255,255,0.08)',
              color: '#FFFFFF',
              fontSize: 22,
              fontWeight: 800,
              cursor: saving ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseEnter={e => {
              if (!saving) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(8,102,255,0.15)'
            }}
            onMouseLeave={e => {
              if (!saving && chosen !== false) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'
            }}
          >
            <span style={{ fontSize: 36 }}>🌐</span>
            Ei, salli ostokset
            <span style={{ fontSize: 14, fontWeight: 400, color: '#A8C0CC' }}>Selaan vapaasti</span>
          </button>
        </div>

        <p style={{ color: '#6A8A9A', fontSize: 14, marginTop: 24 }}>
          Valintasi tallennetaan. Voit aina pyytää apua muuttaaksesi sen.
        </p>
      </div>
    </div>
  )
}
