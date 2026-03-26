import { useState } from 'react'
import type { Settings } from '../types'
import logoUrl from '../assets/upanapu-logo.png'

interface WelcomeScreenProps {
  settings: Settings
  pairCode: string | null
  onDone: (blockPayments: boolean) => void
}

function formatPairCode(code: string): string {
  if (code.length === 12) {
    return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`
  }
  // Fallback for unexpected lengths — show raw code
  return code
}

export default function WelcomeScreen({ settings, pairCode, onDone }: WelcomeScreenProps) {
  const [step, setStep] = useState<'choice' | 'code'>('choice')
  const [chosen, setChosen] = useState<boolean | null>(null)
  const [chosenBlock, setChosenBlock] = useState<boolean>(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleChoice(block: boolean) {
    if (saving) return
    setChosen(block)
    setChosenBlock(block)
    setSaving(true)

    if (pairCode) {
      // Registered device — save choice and dismiss welcome screen immediately.
      // The pair code was already shared on first registration; no need to show
      // step 2 again.  Set firstRun: false so App unmounts WelcomeScreen.
      const newSettings: Settings = { ...settings, blockPayments: block, firstRun: false }
      await window.electronAPI?.updateSettings(newSettings)
      setSaving(false)
      onDone(block)
    } else {
      // New device — keep firstRun: true so WelcomeScreen stays mounted while
      // the user advances to step 2 (pair-code display).  firstRun is set to
      // false only when the user presses the "Valmis" button (handleValmis).
      const newSettings: Settings = { ...settings, blockPayments: block, firstRun: true }
      await window.electronAPI?.updateSettings(newSettings)
      setSaving(false)
      setStep('code')
    }
  }

  async function handleValmis() {
    if (!pairCode) return
    // Now persist firstRun: false and dismiss the welcome screen
    const finalSettings: Settings = {
      ...settings,
      blockPayments: chosenBlock,
      firstRun: false
    }
    await window.electronAPI?.updateSettings(finalSettings)
    onDone(chosenBlock)
  }

  async function handleCopy() {
    if (!pairCode) return
    try {
      await navigator.clipboard.writeText(formatPairCode(pairCode))
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard unavailable — user can still read and type the code manually
    }
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
          <img
            src={logoUrl}
            alt="Upan Apu"
            style={{ height: 80, width: 'auto', margin: '0 auto' }}
          />
          <div style={{ color: '#A8C0CC', fontSize: 16, marginTop: 6 }}>
            Turvaselain
          </div>
        </div>

        {/* Step 1: blockPayments choice */}
        {step === 'choice' && (
          <>
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              border: '2px solid rgba(8,102,255,0.3)',
              borderRadius: 20,
              padding: '32px 36px',
              marginBottom: 36,
            }}>
              <div aria-hidden="true" style={{
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
                Tervetuloa Upan Apu Turvaselaimeen!
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

            <div style={{ display: 'flex', gap: 20, justifyContent: 'center' }}>
              <button
                onClick={() => handleChoice(true)}
                disabled={saving}
                aria-pressed={chosen === true}
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
                  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
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
                <span aria-hidden="true" style={{ fontSize: 36 }}>🛡️</span>
                Kyllä, estä ostokset
                <span style={{ fontSize: 14, fontWeight: 400, color: '#A8C0CC' }}>Varoitus maksu­sivuilla</span>
              </button>

              <button
                onClick={() => handleChoice(false)}
                disabled={saving}
                aria-pressed={chosen === false}
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
                  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
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
                <span aria-hidden="true" style={{ fontSize: 36 }}>🌐</span>
                Ei, salli ostokset
                <span style={{ fontSize: 14, fontWeight: 400, color: '#A8C0CC' }}>Selaan vapaasti</span>
              </button>
            </div>

            <p style={{ color: '#6A8A9A', fontSize: 14, marginTop: 24 }}>
              Valintasi tallennetaan. Voit aina pyytää apua muuttaaksesi sen.
            </p>
          </>
        )}

        {/* Step 2: show pair code */}
        {step === 'code' && (
          <>
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              border: '2px solid rgba(8,102,255,0.3)',
              borderRadius: 20,
              padding: '32px 36px',
              marginBottom: 28,
            }}>
              <div aria-hidden="true" style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(8,102,255,0.15)',
                border: '3px solid #0866FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: 32,
              }}>
                🔑
              </div>

              <h1 style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#FFFFFF',
                marginBottom: 12,
                lineHeight: 1.3,
              }}>
                Tallenna tukihenkilösi koodi
              </h1>

              <p style={{
                fontSize: 17,
                color: '#D0E4EE',
                lineHeight: 1.6,
                marginBottom: 28,
              }}>
                Anna tämä koodi omaisellesi tai tukihenkilöllesi.
                Sen avulla hän voi auttaa sinua etänä.{' '}
                <strong style={{ color: '#FFD700' }}>Koodia ei näytetä enää uudelleen.</strong>
              </p>

              {pairCode ? (
                <div style={{
                  background: 'rgba(8,102,255,0.15)',
                  border: '2px solid rgba(8,102,255,0.5)',
                  borderRadius: 16,
                  padding: '24px 28px',
                  marginBottom: 20,
                }}>
                  <div
                    aria-label={`Laitekoodi: ${formatPairCode(pairCode)}`}
                    style={{
                      fontSize: 44,
                      fontWeight: 900,
                      letterSpacing: '0.12em',
                      color: '#FFD700',
                      fontFamily: 'monospace',
                      userSelect: 'text',
                    }}
                  >
                    {formatPairCode(pairCode)}
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 16,
                  padding: '24px',
                  marginBottom: 20,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 16,
                }}>
                  Ladataan koodia…
                </div>
              )}

              <button
                onClick={handleCopy}
                disabled={!pairCode}
                style={{
                  padding: '14px 32px',
                  background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
                  border: copied ? '2px solid rgba(34,197,94,0.6)' : '2px solid rgba(255,255,255,0.2)',
                  borderRadius: 12,
                  color: copied ? '#4ade80' : '#FFFFFF',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: pairCode ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                  marginBottom: 8,
                }}
              >
                {copied ? '✓ Koodi kopioitu!' : '📋 Kopioi koodi'}
              </button>
            </div>

            <button
              onClick={handleValmis}
              disabled={!pairCode}
              style={{
                width: '100%',
                maxWidth: 340,
                padding: '20px',
                borderRadius: 16,
                border: pairCode ? '3px solid #0866FF' : '3px solid rgba(255,255,255,0.15)',
                background: pairCode ? '#0866FF' : 'rgba(255,255,255,0.08)',
                color: pairCode ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                fontSize: 20,
                fontWeight: 800,
                cursor: pairCode ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => {
                if (pairCode) (e.currentTarget as HTMLButtonElement).style.background = '#0755D4'
              }}
              onMouseLeave={e => {
                if (pairCode) (e.currentTarget as HTMLButtonElement).style.background = '#0866FF'
              }}
            >
              {pairCode ? 'Valmis — aloita selaus' : 'Ladataan koodia…'}
            </button>

            <p style={{ color: '#6A8A9A', fontSize: 14, marginTop: 20 }}>
              Tallennetko koodin ensin? Voit kopioida sen yllä.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
