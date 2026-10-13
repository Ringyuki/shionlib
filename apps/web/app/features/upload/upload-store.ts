import type { UploadState } from './upload'
import { emptyState } from './upload'
import { savedStateOf } from './upload-restore'
import { reduce, type UploadEvent } from './upload-state'
import type { SavedState } from './upload.schema'

export class UploadStore {
  private state: UploadState = emptyState
  private readonly listeners = new Set<() => void>()
  private readonly save: (state: SavedState) => void

  constructor(save: (state: SavedState) => void) {
    this.save = save
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.state

  dispatch(event: UploadEvent) {
    this.state = reduce(this.state, event)
    if (event.type !== 'progressed') {
      this.save(savedStateOf(this.state))
    }
    this.listeners.forEach(listener => listener())
  }
}
