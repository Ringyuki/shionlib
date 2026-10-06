import { createContext, useContext, useSyncExternalStore } from 'react'
import { emptyState, type UploadState } from './upload'
import type { UploadManager } from './upload-manager'

export const UploadContext = createContext<UploadManager | undefined>(undefined)

const ignore = () => () => undefined

const empty = () => emptyState

export function useUploadManager(): UploadManager | undefined {
  return useContext(UploadContext)
}

export function useUploads(): UploadState {
  const manager = useUploadManager()
  return useSyncExternalStore(manager?.subscribe ?? ignore, manager?.getSnapshot ?? empty, empty)
}
