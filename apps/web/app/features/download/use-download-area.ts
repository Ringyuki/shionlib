import { createContext, useContext } from 'react'
import type { DownloadGame } from './download'

export type DownloadAreaValue = {
  game: DownloadGame
  openSettings: () => void
}

export const DownloadAreaContext = createContext<DownloadAreaValue | undefined>(undefined)

export function useDownloadArea(): DownloadAreaValue | undefined {
  return useContext(DownloadAreaContext)
}
