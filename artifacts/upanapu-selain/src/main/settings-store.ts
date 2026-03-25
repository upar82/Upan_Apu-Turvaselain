import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export interface Settings {
  homeUrl: string
  tutorMode: boolean
  fontSize: 'normal' | 'large' | 'xlarge'
}

const DEFAULT_SETTINGS: Settings = {
  homeUrl: 'https://www.google.fi',
  tutorMode: true,
  fontSize: 'large'
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'upanapu-settings.json')
}

export function getSettings(): Settings {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true })
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
  } catch (err) {
    console.error('Asetuksien tallennus epäonnistui:', err)
  }
}
