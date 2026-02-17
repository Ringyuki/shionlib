import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { Aria2Settings, TestStatus } from '@/interfaces/aria2/aria2.interface'

interface LocalSettingsStore {
  settings: Aria2Settings
  getSettings: () => Aria2Settings
  setSettings: (settings: Partial<Aria2Settings>) => void
  position: ToastPosition
  setPosition: (position: ToastPosition) => void
}

export const toastPositions = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
] as const

export type ToastPosition = (typeof toastPositions)[number]

export const defaultToastPosition: ToastPosition = 'bottom-center'

export const initialSettings: Aria2Settings = {
  protocol: 'http',
  host: 'localhost',
  port: 6800,
  path: '/jsonrpc',
  auth_secret: '',
  downloadPath: '',
}

const ensureAllFields = (settings: Partial<Aria2Settings>): Aria2Settings => ({
  protocol: settings.protocol ?? initialSettings.protocol,
  host: settings.host ?? initialSettings.host,
  port: settings.port ?? initialSettings.port,
  path: settings.path ?? initialSettings.path,
  auth_secret: settings.auth_secret ?? initialSettings.auth_secret,
  downloadPath: settings.downloadPath ?? initialSettings.downloadPath,
})

export interface Aria2TestStore {
  testStatus: TestStatus
  testMessage: string
  setTestStatus: (status: TestStatus) => void
  setTestMessage: (message: string) => void
}

const initialTestStatus: TestStatus = 'idle'
const initialTestMessage: string = ''
export const useAria2TestStore = create<Aria2TestStore>(set => ({
  testStatus: initialTestStatus,
  testMessage: initialTestMessage,
  setTestStatus: (status: TestStatus) => set({ testStatus: status }),
  setTestMessage: (message: string) => set({ testMessage: message }),
}))

const useLocalSettingsStore = create<LocalSettingsStore>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      getSettings: () => ensureAllFields(get().settings),
      setSettings: (settings: Partial<Aria2Settings>) =>
        set({ settings: ensureAllFields(settings) }),
      position: defaultToastPosition,
      setPosition: (position: ToastPosition) => set({ position }),
    }),
    {
      name: 'shionlib-local-settings-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

export const useAria2Store = useLocalSettingsStore
export const useToastPreferenceStore = useLocalSettingsStore
