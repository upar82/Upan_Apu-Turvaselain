import { app, BrowserWindow, ipcMain, WebContentsView, shell, nativeTheme } from 'electron'
import path from 'path'
import { getSettings, saveSettings, type Settings } from './settings-store'

nativeTheme.themeSource = 'light'

let mainWindow: BrowserWindow | null = null
let browserView: WebContentsView | null = null

const TOOLBAR_HEIGHT = 104

function createWindow(): void {
  const settings = getSettings()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "Upa'n Apu Selain",
    backgroundColor: '#1A2B38',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  browserView = new WebContentsView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  mainWindow.contentView.addChildView(browserView)
  updateBrowserViewBounds()
  browserView.webContents.loadURL(settings.homeUrl)
  setupBrowserViewEvents()

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('resize', updateBrowserViewBounds)
  mainWindow.on('closed', () => {
    mainWindow = null
    browserView = null
  })

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow || !browserView) return
    const currentUrl = browserView.webContents.getURL()
    if (currentUrl) {
      mainWindow.webContents.send('browser:urlChanged', currentUrl)
    }
    mainWindow.webContents.send('browser:canNavigate',
      browserView.webContents.canGoBack(),
      browserView.webContents.canGoForward()
    )
    mainWindow.webContents.send('settings:updated', settings)
  })
}

function updateBrowserViewBounds(): void {
  if (!mainWindow || !browserView) return
  const bounds = mainWindow.getContentBounds()
  browserView.setBounds({
    x: 0,
    y: TOOLBAR_HEIGHT,
    width: bounds.width,
    height: Math.max(0, bounds.height - TOOLBAR_HEIGHT)
  })
}

function setupBrowserViewEvents(): void {
  if (!browserView || !mainWindow) return

  browserView.webContents.on('did-navigate', (_event, url) => {
    mainWindow?.webContents.send('browser:urlChanged', url)
    updateNavigationState()
  })

  browserView.webContents.on('did-navigate-in-page', (_event, url) => {
    mainWindow?.webContents.send('browser:urlChanged', url)
    updateNavigationState()
  })

  browserView.webContents.on('did-start-loading', () => {
    mainWindow?.webContents.send('browser:loadingChanged', true)
  })

  browserView.webContents.on('did-stop-loading', () => {
    mainWindow?.webContents.send('browser:loadingChanged', false)
    updateNavigationState()
  })

  browserView.webContents.on('page-title-updated', (_event, title) => {
    mainWindow?.webContents.send('browser:titleChanged', title)
    if (mainWindow) {
      mainWindow.setTitle(title ? `${title} — Upa'n Apu Selain` : "Upa'n Apu Selain")
    }
  })

  browserView.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      browserView?.webContents.loadURL(url)
    }
    return { action: 'deny' }
  })

  browserView.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) return
    event.preventDefault()
    if (url.startsWith('file://')) {
      shell.openExternal(url)
    }
  })
}

function updateNavigationState(): void {
  if (!browserView || !mainWindow) return
  mainWindow.webContents.send('browser:canNavigate',
    browserView.webContents.canGoBack(),
    browserView.webContents.canGoForward()
  )
}

function resolveUrl(input: string): string {
  const trimmed = input.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.includes('.') && !trimmed.includes(' ') && !trimmed.startsWith('/')) {
    return 'https://' + trimmed
  }
  return `https://www.google.fi/search?q=${encodeURIComponent(trimmed)}`
}

ipcMain.on('browser:navigate', (_event, url: string) => {
  browserView?.webContents.loadURL(resolveUrl(url))
})

ipcMain.on('browser:goBack', () => {
  if (browserView?.webContents.canGoBack()) {
    browserView.webContents.goBack()
  }
})

ipcMain.on('browser:goForward', () => {
  if (browserView?.webContents.canGoForward()) {
    browserView.webContents.goForward()
  }
})

ipcMain.on('browser:reload', () => {
  browserView?.webContents.reload()
})

ipcMain.on('browser:goHome', () => {
  const settings = getSettings()
  browserView?.webContents.loadURL(settings.homeUrl)
})

ipcMain.handle('settings:get', (): Settings => {
  return getSettings()
})

ipcMain.handle('settings:update', (_event, newSettings: Settings): boolean => {
  saveSettings(newSettings)
  mainWindow?.webContents.send('settings:updated', newSettings)
  return true
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
