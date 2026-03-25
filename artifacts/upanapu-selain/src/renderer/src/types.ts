export interface Settings {
  homeUrl: string
  tutorMode: boolean
  fontSize: 'normal' | 'large' | 'xlarge'
  firstRun: boolean
  blockPayments: boolean
}

export interface ElectronAPI {
  navigate: (url: string) => void
  goBack: () => void
  goForward: () => void
  reload: () => void
  goHome: () => void
  onUrlChange: (callback: (url: string) => void) => () => void
  onLoadingChange: (callback: (loading: boolean) => void) => () => void
  onCanNavigate: (callback: (canGoBack: boolean, canGoForward: boolean) => void) => () => void
  onTitleChange: (callback: (title: string) => void) => () => void
  onWarning: (callback: (warning: string | null) => void) => () => void
  getSettings: () => Promise<Settings>
  updateSettings: (settings: Settings) => Promise<boolean>
  onSettingsUpdated: (callback: (settings: Settings) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
