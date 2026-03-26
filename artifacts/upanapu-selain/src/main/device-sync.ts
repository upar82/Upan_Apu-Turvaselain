import { getSettings, saveSettings } from './settings-store'
import type { Settings } from './settings-store'

const API_BASE = process.env['VITE_API_URL'] || 'https://upanapu-api.replit.app'
const POLL_INTERVAL_MS = 30_000

let pollTimer: ReturnType<typeof setInterval> | null = null
let onSettingsChanged: ((settings: Settings) => void) | null = null
let onMessageReceived: ((message: string) => void) | null = null
let onOtpRequest: ((otp: string, expiresAt: Date) => void) | null = null
let onRegisterError: (() => void) | null = null

// Track last seen OTP to avoid triggering the modal repeatedly on every poll
let lastSeenOtp: string | null = null

export function setSettingsChangedCallback(fn: (settings: Settings) => void): void {
  onSettingsChanged = fn
}

export function setMessageReceivedCallback(fn: (message: string) => void): void {
  onMessageReceived = fn
}

export function setOtpCallback(fn: (otp: string, expiresAt: Date) => void): void {
  onOtpRequest = fn
}

export function setRegisterErrorCallback(fn: () => void): void {
  onRegisterError = fn
}

const REGISTER_TIMEOUT_MS = 15_000

export async function doRegister(): Promise<{ deviceId: string; pairCode: string } | null> {
  const settings = getSettings()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REGISTER_TIMEOUT_MS)

  try {
    const res = await fetch(`${API_BASE}/api/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          homeUrl: settings.homeUrl,
          tutorMode: settings.tutorMode,
          fontSize: settings.fontSize,
          blockPayments: settings.blockPayments
        }
      }),
      signal: controller.signal
    })

    if (!res.ok) {
      console.warn('[device-sync] Rekisteröinti epäonnistui:', res.status)
      return null
    }

    const data = await res.json() as { deviceId: string; pairCode: string }
    saveSettings({ deviceId: data.deviceId, pairCode: data.pairCode, syncEnabled: true })
    console.log('[device-sync] Laite rekisteröity, koodi:', data.pairCode)
    return data
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      console.warn('[device-sync] Rekisteröinti aikakatkaistiin (15s)')
    } else {
      console.warn('[device-sync] Rekisteröintivirhe:', err)
    }
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function registerDevice(): Promise<{ deviceId: string; pairCode: string } | null> {
  const settings = getSettings()
  if (settings.deviceId && settings.pairCode) {
    return { deviceId: settings.deviceId, pairCode: settings.pairCode }
  }
  return doRegister()
}

async function sendHeartbeat(pairCode: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/devices/${pairCode}/heartbeat`, { method: 'POST' })
  } catch {
    // heartbeat failures are silent
  }
}

export async function reportUrl(pairCode: string, url: string, title?: string): Promise<void> {
  if (!url || url.startsWith('about:') || url.startsWith('chrome:')) return
  try {
    await fetch(`${API_BASE}/api/devices/${pairCode}/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title: title ?? null })
    })
  } catch {
    // URL reporting failures are silent
  }
}

async function pollMessage(pairCode: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/devices/${pairCode}/message`)
    if (!res.ok) return

    const data = await res.json() as { message: string | null }
    if (!data.message) return

    // Fire callback so main process can display in renderer.
    // The message is NOT deleted here — it is deleted only when
    // the elderly user explicitly dismisses it (device:clearMessage IPC).
    onMessageReceived?.(data.message)
  } catch {
    // message polling failures are silent
  }
}

export async function deleteMessage(pairCode: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/devices/${pairCode}/message`, { method: 'DELETE' })
  } catch {
    // silent
  }
}

async function fetchAndApplySettings(pairCode: string): Promise<void> {
  // Always send heartbeat first — device is online regardless of settings result
  void sendHeartbeat(pairCode)

  // Poll for pending message from portal
  void pollMessage(pairCode)

  try {
    const res = await fetch(`${API_BASE}/api/devices/${pairCode}/settings`)

    if (res.status === 410 || res.status === 404) {
      // Code expired or not found — clear pairing and re-register to get a fresh code
      console.warn('[device-sync] Laitekoodi vanhentunut tai poistettu, uudelleenrekisteröidään...')
      saveSettings({ deviceId: undefined, pairCode: undefined, syncEnabled: false })
      stopSync()
      const fresh = await doRegister()
      if (fresh) {
        onSettingsChanged?.(getSettings())
        startSync()
      } else {
        // Re-registration failed — notify renderer so it can show error/retry UI
        onRegisterError?.()
      }
      return
    }

    if (!res.ok) return

    const data = await res.json() as {
      settings: Partial<Settings>
      pairingOtp?: string | null
      pairingOtpExpires?: string | null
    }

    // Check for a new OTP pairing request
    const incomingOtp = data.pairingOtp ?? null
    if (incomingOtp && incomingOtp !== lastSeenOtp && data.pairingOtpExpires) {
      lastSeenOtp = incomingOtp
      const expiresAt = new Date(data.pairingOtpExpires)
      // Only show if not already expired
      if (expiresAt > new Date()) {
        onOtpRequest?.(incomingOtp, expiresAt)
      }
    } else if (!incomingOtp && lastSeenOtp !== null) {
      // OTP was confirmed or expired — reset tracking
      lastSeenOtp = null
    }

    const remote = data.settings as Partial<Settings>
    const local = getSettings()

    const changed =
      (remote.homeUrl !== undefined && remote.homeUrl !== local.homeUrl) ||
      (remote.tutorMode !== undefined && remote.tutorMode !== local.tutorMode) ||
      (remote.fontSize !== undefined && remote.fontSize !== local.fontSize) ||
      (remote.blockPayments !== undefined && remote.blockPayments !== local.blockPayments)

    if (changed) {
      const merged: Settings = {
        ...local,
        homeUrl: remote.homeUrl ?? local.homeUrl,
        tutorMode: remote.tutorMode ?? local.tutorMode,
        fontSize: remote.fontSize ?? local.fontSize,
        blockPayments: remote.blockPayments ?? local.blockPayments
      }
      saveSettings(merged)
      onSettingsChanged?.(merged)
      console.log('[device-sync] Asetukset päivitetty etänä')
    }
  } catch (err) {
    console.warn('[device-sync] Pollausvirhe:', err)
  }
}

export function startSync(): void {
  if (pollTimer) return

  const settings = getSettings()
  if (!settings.pairCode) {
    console.log('[device-sync] Ei laitekoodia — synkronointi ei käynnisty')
    return
  }

  const pairCode = settings.pairCode

  void fetchAndApplySettings(pairCode)

  pollTimer = setInterval(() => {
    const current = getSettings()
    if (current.pairCode) {
      void fetchAndApplySettings(current.pairCode)
    }
  }, POLL_INTERVAL_MS)

  console.log('[device-sync] Synkronointi käynnistetty, pollaus 30s välein')
}

export function stopSync(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
    console.log('[device-sync] Synkronointi pysäytetty')
  }
}

export function getPairCode(): string | null {
  return getSettings().pairCode ?? null
}
