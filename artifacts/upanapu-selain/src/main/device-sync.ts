import { getSettings, saveSettings } from './settings-store'
import type { Settings } from './settings-store'

const API_BASE = process.env['VITE_API_URL'] || 'https://upanapu-api.replit.app'
const POLL_INTERVAL_MS = 30_000

let pollTimer: ReturnType<typeof setInterval> | null = null
let onSettingsChanged: ((settings: Settings) => void) | null = null

export function setSettingsChangedCallback(fn: (settings: Settings) => void): void {
  onSettingsChanged = fn
}

export async function registerDevice(): Promise<{ deviceId: string; pairCode: string } | null> {
  const settings = getSettings()

  if (settings.deviceId && settings.pairCode) {
    return { deviceId: settings.deviceId, pairCode: settings.pairCode }
  }

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
      })
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
    console.warn('[device-sync] Rekisteröintivirhe:', err)
    return null
  }
}

async function sendHeartbeat(pairCode: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/devices/${pairCode}/heartbeat`, { method: 'POST' })
  } catch {
    // heartbeat failures are silent
  }
}

async function fetchAndApplySettings(pairCode: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/devices/${pairCode}/settings`)
    if (!res.ok) return

    const data = await res.json() as { settings: Partial<Settings> }
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

    await sendHeartbeat(pairCode)
  } catch (err) {
    console.warn('[device-sync] Pollausvirhe:', err)
  }
}

export function startSync(): void {
  if (pollTimer) return

  const settings = getSettings()
  if (!settings.pairCode || !settings.syncEnabled) return

  const pairCode = settings.pairCode

  void fetchAndApplySettings(pairCode)

  pollTimer = setInterval(() => {
    void fetchAndApplySettings(pairCode)
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
  return getSettings().pairCode
}
