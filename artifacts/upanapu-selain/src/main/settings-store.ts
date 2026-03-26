import Store from 'electron-store'

export interface Settings {
  homeUrl: string
  tutorMode: boolean
  fontSize: 'normal' | 'large' | 'xlarge'
  firstRun: boolean
  blockPayments: boolean
  deviceId: string | null
  pairCode: string | null
  syncEnabled: boolean
  pairCodeShown: boolean
}

type Schema = {
  homeUrl: string
  tutorMode: boolean
  fontSize: 'normal' | 'large' | 'xlarge'
  firstRun: boolean
  blockPayments: boolean
  deviceId: string | null
  pairCode: string | null
  syncEnabled: boolean
  pairCodeShown: boolean
}

const store = new Store<Schema>({
  name: 'upanapu-settings',
  defaults: {
    homeUrl: 'https://www.google.fi',
    tutorMode: true,
    fontSize: 'large',
    firstRun: true,
    blockPayments: false,
    deviceId: null,
    pairCode: null,
    syncEnabled: false,
    pairCodeShown: false
  },
  schema: {
    homeUrl: {
      type: 'string',
      default: 'https://www.google.fi'
    },
    tutorMode: {
      type: 'boolean',
      default: true
    },
    fontSize: {
      type: 'string',
      enum: ['normal', 'large', 'xlarge'],
      default: 'large'
    },
    firstRun: {
      type: 'boolean',
      default: true
    },
    blockPayments: {
      type: 'boolean',
      default: false
    },
    deviceId: {
      type: ['string', 'null'],
      default: null
    },
    pairCode: {
      type: ['string', 'null'],
      default: null
    },
    syncEnabled: {
      type: 'boolean',
      default: false
    },
    pairCodeShown: {
      type: 'boolean',
      default: false
    }
  }
})

export function getSettings(): Settings {
  return {
    homeUrl: store.get('homeUrl'),
    tutorMode: store.get('tutorMode'),
    fontSize: store.get('fontSize') as Settings['fontSize'],
    firstRun: store.get('firstRun'),
    blockPayments: store.get('blockPayments'),
    deviceId: store.get('deviceId') as string | null,
    pairCode: store.get('pairCode') as string | null,
    syncEnabled: store.get('syncEnabled'),
    pairCodeShown: store.get('pairCodeShown')
  }
}

export function saveSettings(settings: Partial<Settings>): void {
  if (settings.homeUrl !== undefined) store.set('homeUrl', settings.homeUrl)
  if (settings.tutorMode !== undefined) store.set('tutorMode', settings.tutorMode)
  if (settings.fontSize !== undefined) store.set('fontSize', settings.fontSize)
  if (settings.firstRun !== undefined) store.set('firstRun', settings.firstRun)
  if (settings.blockPayments !== undefined) store.set('blockPayments', settings.blockPayments)
  if (settings.deviceId !== undefined) store.set('deviceId', settings.deviceId)
  if (settings.pairCode !== undefined) store.set('pairCode', settings.pairCode)
  if (settings.syncEnabled !== undefined) store.set('syncEnabled', settings.syncEnabled)
  if (settings.pairCodeShown !== undefined) store.set('pairCodeShown', settings.pairCodeShown)
}
