import { app, BrowserWindow, ipcMain, WebContentsView, shell, nativeTheme, Menu, desktopCapturer } from 'electron'
import path from 'path'
import { getSettings, saveSettings, type Settings } from './settings-store'
import { registerDevice, doRegister, startSync, stopSync, getPairCode, setSettingsChangedCallback, setMessageReceivedCallback, setOtpCallback, setRegisterErrorCallback, reportUrl, deleteMessage } from './device-sync'
import { injectCookieConsent } from './cookie-consent'

nativeTheme.themeSource = 'light'

function buildMinimalMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = isMac
    ? [
        {
          label: app.name,
          submenu: [
            { label: `Tietoja — Upan Apu Turvaselain`, role: 'about' },
            { type: 'separator' },
            { label: 'Sulje ohjelma', role: 'quit', accelerator: 'Cmd+Q' }
          ]
        },
        {
          label: 'Muokkaa',
          submenu: [
            { label: 'Kumoa', role: 'undo', accelerator: 'Cmd+Z' },
            { type: 'separator' },
            { label: 'Leikkaa', role: 'cut', accelerator: 'Cmd+X' },
            { label: 'Kopioi', role: 'copy', accelerator: 'Cmd+C' },
            { label: 'Liitä', role: 'paste', accelerator: 'Cmd+V' },
            { label: 'Valitse kaikki', role: 'selectAll', accelerator: 'Cmd+A' }
          ]
        }
      ]
    : []

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu.items.length > 0 ? menu : null)
}

let mainWindow: BrowserWindow | null = null
let browserView: WebContentsView | null = null

const TOOLBAR_HEIGHT = 104

const PAYMENT_KEYWORDS = [
  'checkout', 'payment', 'maksa', 'tilaus', 'luottokortti',
  'ostoskori', 'cart', 'shop', 'store', 'osta', 'paypal',
  'stripe', 'klarna', 'maksut', 'verkkokauppa', 'buy', 'purchase',
  'tilaa', 'billing', 'invoice'
]

function checkUrlForWarning(url: string, settings: Settings): string | null {
  if (!url || url.startsWith('about:') || url.startsWith('chrome:')) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:') {
      return 'Tämä sivu ei ole turvallinen! Yhteys ei ole salattu — älä kirjoita salasanoja tai henkilötietoja.'
    }
    if (settings.blockPayments) {
      const urlLower = url.toLowerCase()
      const isPaymentSite = PAYMENT_KEYWORDS.some(kw => urlLower.includes(kw))
      if (isPaymentSite) {
        return 'Tämä sivu vaikuttaa maksu- tai ostossivulta. Olet valinnut estää verkko-ostokset.'
      }
    }
    return null
  } catch {
    return null
  }
}

function createWindow(): void {
  const settings = getSettings()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "Upan Apu Turvaselain",
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
  updateBrowserViewBounds(settings.firstRun)

  if (!settings.firstRun) {
    browserView.webContents.loadURL(settings.homeUrl)
  }

  setupBrowserViewEvents()

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Grant screen-capture permissions ONLY to the trusted main renderer (toolbar UI),
  // never to external web content loaded in browserView.
  const trustedWebContentsId = mainWindow.webContents.id
  mainWindow.webContents.session.setPermissionRequestHandler((wc, permission, callback) => {
    if (
      (permission === 'media' || permission === 'display-capture') &&
      wc.id === trustedWebContentsId
    ) {
      callback(true)
    } else {
      callback(false)
    }
  })

  mainWindow.on('resize', () => {
    const s = getSettings()
    updateBrowserViewBounds(s.firstRun)
  })
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
    mainWindow.webContents.send('settings:updated', getSettings())
  })
}

function updateBrowserViewBounds(hidden = false): void {
  if (!mainWindow || !browserView) return
  const bounds = mainWindow.getContentBounds()
  if (hidden) {
    browserView.setBounds({ x: 0, y: bounds.height, width: bounds.width, height: 0 })
  } else {
    browserView.setBounds({
      x: 0,
      y: TOOLBAR_HEIGHT,
      width: bounds.width,
      height: Math.max(0, bounds.height - TOOLBAR_HEIGHT)
    })
  }
}

function setupBrowserViewEvents(): void {
  if (!browserView || !mainWindow) return

  browserView.webContents.on('did-navigate', (_event, url) => {
    mainWindow?.webContents.send('browser:urlChanged', url)
    updateNavigationState()
    const settings = getSettings()
    const warning = checkUrlForWarning(url, settings)
    mainWindow?.webContents.send('browser:warning', warning)
    if (settings.pairCode) {
      const title = browserView?.webContents.getTitle() ?? undefined
      void reportUrl(settings.pairCode, url, title)
    }
  })

  browserView.webContents.on('did-navigate-in-page', (_event, url) => {
    mainWindow?.webContents.send('browser:urlChanged', url)
    updateNavigationState()
    const settings = getSettings()
    const warning = checkUrlForWarning(url, settings)
    mainWindow?.webContents.send('browser:warning', warning)
    if (settings.pairCode) {
      const title = browserView?.webContents.getTitle() ?? undefined
      void reportUrl(settings.pairCode, url, title)
    }
  })

  browserView.webContents.on('did-start-loading', () => {
    mainWindow?.webContents.send('browser:loadingChanged', true)
  })

  browserView.webContents.on('did-stop-loading', () => {
    mainWindow?.webContents.send('browser:loadingChanged', false)
    updateNavigationState()
  })

  browserView.webContents.on('did-finish-load', () => {
    const url = browserView?.webContents.getURL() ?? ''
    const settings = getSettings()
    injectCookieConsent(browserView!.webContents, url, settings)
  })

  browserView.webContents.on('page-title-updated', (_event, title) => {
    mainWindow?.webContents.send('browser:titleChanged', title)
    if (mainWindow) {
      mainWindow.setTitle(title ? `${title} — Upan Apu Turvaselain` : "Upan Apu Turvaselain")
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
  const updated = getSettings()
  mainWindow?.webContents.send('settings:updated', updated)

  if (!newSettings.firstRun) {
    updateBrowserViewBounds(false)
    const current = browserView?.webContents.getURL()
    if (!current || current === 'about:blank' || current === '') {
      browserView?.webContents.loadURL(newSettings.homeUrl)
    }
  }

  return true
})

ipcMain.handle('device:getPairCode', (): string | null => {
  return getPairCode()
})

ipcMain.handle('device:getStatus', (): { pairCode: string | null; syncEnabled: boolean; deviceId: string | null } => {
  const s = getSettings()
  return { pairCode: s.pairCode, syncEnabled: s.syncEnabled, deviceId: s.deviceId }
})

ipcMain.handle('device:clearMessage', async (): Promise<void> => {
  const s = getSettings()
  if (s.pairCode) {
    await deleteMessage(s.pairCode)
  }
})

ipcMain.handle('device:registerRetry', async (): Promise<boolean> => {
  const result = await doRegister()
  if (result) {
    const updatedSettings = getSettings()
    mainWindow?.webContents.send('settings:updated', updatedSettings)
    startSync()
    return true
  }
  mainWindow?.webContents.send('device:registerError')
  return false
})

ipcMain.handle('screenshare:getSourceId', async (): Promise<string | null> => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return sources[0]?.id ?? null
  } catch (err) {
    console.warn('[screenshare] getSources failed:', err)
    return null
  }
})


app.whenReady().then(async () => {
  buildMinimalMenu()

  // Always reset firstRun: true before creating the window so the payment
  // question (WelcomeScreen step 1) is shown on every launch.
  // firstRun: false is only kept for the current session — it is never
  // carried over to the next startup.
  saveSettings({ firstRun: true })

  createWindow()

  // Clear all browsing data from previous session (incognito-like behaviour)
  if (browserView) {
    const ses = browserView.webContents.session
    await ses.clearStorageData()
    await ses.clearCache()
  }

  setSettingsChangedCallback((newSettings: Settings) => {
    mainWindow?.webContents.send('settings:updated', newSettings)
    const current = browserView?.webContents.getURL()
    const home = newSettings.homeUrl
    if (current && current !== home && !current.startsWith('about:')) {
      browserView?.webContents.loadURL(home)
    }
  })

  setMessageReceivedCallback((message: string) => {
    mainWindow?.webContents.send('browser:message', message)
  })

  setOtpCallback((otp: string, expiresAt: Date) => {
    mainWindow?.webContents.send('browser:otp', otp, expiresAt.toISOString())
  })

  setRegisterErrorCallback(() => {
    mainWindow?.webContents.send('device:registerError')
  })

  const registered = await registerDevice()
  if (registered) {
    const updatedSettings = getSettings()
    mainWindow?.webContents.send('settings:updated', updatedSettings)
  } else if (!getSettings().pairCode) {
    // Registration failed and no pair code is available — notify renderer so it
    // can show an error instead of an infinite "Ladataan koodia..." spinner.
    mainWindow?.webContents.send('device:registerError')
  }

  startSync()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopSync()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
