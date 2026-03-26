import { contextBridge, ipcRenderer } from 'electron'
import type { Settings } from '../main/settings-store'

contextBridge.exposeInMainWorld('electronAPI', {
  navigate: (url: string) => ipcRenderer.send('browser:navigate', url),
  goBack: () => ipcRenderer.send('browser:goBack'),
  goForward: () => ipcRenderer.send('browser:goForward'),
  reload: () => ipcRenderer.send('browser:reload'),
  goHome: () => ipcRenderer.send('browser:goHome'),

  onUrlChange: (callback: (url: string) => void) => {
    const listener = (_: Electron.IpcRendererEvent, url: string) => callback(url)
    ipcRenderer.on('browser:urlChanged', listener)
    return () => ipcRenderer.removeListener('browser:urlChanged', listener)
  },

  onLoadingChange: (callback: (loading: boolean) => void) => {
    const listener = (_: Electron.IpcRendererEvent, loading: boolean) => callback(loading)
    ipcRenderer.on('browser:loadingChanged', listener)
    return () => ipcRenderer.removeListener('browser:loadingChanged', listener)
  },

  onCanNavigate: (callback: (canGoBack: boolean, canGoForward: boolean) => void) => {
    const listener = (_: Electron.IpcRendererEvent, back: boolean, fwd: boolean) => callback(back, fwd)
    ipcRenderer.on('browser:canNavigate', listener)
    return () => ipcRenderer.removeListener('browser:canNavigate', listener)
  },

  onTitleChange: (callback: (title: string) => void) => {
    const listener = (_: Electron.IpcRendererEvent, title: string) => callback(title)
    ipcRenderer.on('browser:titleChanged', listener)
    return () => ipcRenderer.removeListener('browser:titleChanged', listener)
  },

  onWarning: (callback: (warning: string | null) => void) => {
    const listener = (_: Electron.IpcRendererEvent, warning: string | null) => callback(warning)
    ipcRenderer.on('browser:warning', listener)
    return () => ipcRenderer.removeListener('browser:warning', listener)
  },

  getSettings: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Settings): Promise<boolean> => ipcRenderer.invoke('settings:update', settings),

  onSettingsUpdated: (callback: (settings: Settings) => void) => {
    const listener = (_: Electron.IpcRendererEvent, settings: Settings) => callback(settings)
    ipcRenderer.on('settings:updated', listener)
    return () => ipcRenderer.removeListener('settings:updated', listener)
  },

  getDeviceStatus: (): Promise<{ pairCode: string | null; syncEnabled: boolean; deviceId: string | null }> =>
    ipcRenderer.invoke('device:getStatus'),

  getPairCode: (): Promise<string | null> =>
    ipcRenderer.invoke('device:getPairCode'),

  onMessage: (callback: (message: string) => void) => {
    const listener = (_: Electron.IpcRendererEvent, message: string) => callback(message)
    ipcRenderer.on('browser:message', listener)
    return () => ipcRenderer.removeListener('browser:message', listener)
  },

  clearMessage: (): Promise<void> =>
    ipcRenderer.invoke('device:clearMessage'),

  getScreenSourceId: (): Promise<string | null> =>
    ipcRenderer.invoke('screenshare:getSourceId'),

  onOtpRequest: (callback: (otp: string, expiresAt: string) => void) => {
    const listener = (_: Electron.IpcRendererEvent, otp: string, expiresAt: string) => callback(otp, expiresAt)
    ipcRenderer.on('browser:otp', listener)
    return () => ipcRenderer.removeListener('browser:otp', listener)
  },

  onOtpCleared: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('browser:otp-cleared', listener)
    return () => ipcRenderer.removeListener('browser:otp-cleared', listener)
  },

  registerRetry: (): Promise<boolean> =>
    ipcRenderer.invoke('device:registerRetry'),

  onRegisterError: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('device:registerError', listener)
    return () => ipcRenderer.removeListener('device:registerError', listener)
  },
})
