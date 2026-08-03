import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { Aria2Settings, TestStatus } from '@/interfaces/aria2/aria2.interface'
import { useMedia } from 'react-use'

interface LocalSettingsStore {
  settings: Aria2Settings
  getSettings: () => Aria2Settings
  setSettings: (settings: Partial<Aria2Settings>) => void
  position: ToastPosition | null
  setPosition: (position: ToastPosition) => void
  showLunaBox: boolean
  setShowLunaBox: (show: boolean) => void
  showReina: boolean
  setShowReina: (show: boolean) => void
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
export const useDefaultToastPosition = () => {
  const isMobile = useMedia('(max-width: 768px)', false)
  return isMobile ? 'bottom-center' : 'top-center'
}

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
  setTestStatus: (status: TestStatus) => void
}

const initialTestStatus: TestStatus = 'idle'
export const useAria2TestStore = create<Aria2TestStore>(set => ({
  testStatus: initialTestStatus,
  setTestStatus: (status: TestStatus) => set({ testStatus: status }),
}))

const useLocalSettingsStore = create<LocalSettingsStore>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      getSettings: () => ensureAllFields(get().settings),
      setSettings: (settings: Partial<Aria2Settings>) =>
        set({ settings: ensureAllFields(settings) }),
      position: null,
      setPosition: (position: ToastPosition) => set({ position }),
      showLunaBox: true,
      setShowLunaBox: (show: boolean) => set({ showLunaBox: show }),
      showReina: true,
      setShowReina: (show: boolean) => set({ showReina: show }),
    }),
    {
      name: 'shionlib-local-settings-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

export const useAria2Store = useLocalSettingsStore
export const useToastPreferenceStore = useLocalSettingsStore
export const useLunaBoxStore = useLocalSettingsStore
export const useReinaStore = useLocalSettingsStore
