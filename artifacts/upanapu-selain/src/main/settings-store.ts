import Store from 'electron-store'

export interface Settings {
  homeUrl: string
  tutorMode: boolean
  fontSize: 'normal' | 'large' | 'xlarge'
}

type Schema = {
  homeUrl: string
  tutorMode: boolean
  fontSize: 'normal' | 'large' | 'xlarge'
}

const store = new Store<Schema>({
  name: 'upanapu-settings',
  defaults: {
    homeUrl: 'https://www.google.fi',
    tutorMode: true,
    fontSize: 'large'
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
    }
  }
})

export function getSettings(): Settings {
  return {
    homeUrl: store.get('homeUrl'),
    tutorMode: store.get('tutorMode'),
    fontSize: store.get('fontSize') as Settings['fontSize']
  }
}

export function saveSettings(settings: Settings): void {
  store.set({
    homeUrl: settings.homeUrl,
    tutorMode: settings.tutorMode,
    fontSize: settings.fontSize
  })
}
