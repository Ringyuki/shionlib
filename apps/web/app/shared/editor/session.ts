import type { OverlayAnchor } from '@hina-ui/react'
import { useSyncExternalStore } from 'react'
import type { SlashCommand } from './plugin'

export type Store<Value> = {
  get: () => Value
  set: (next: Value) => void
  subscribe: (listener: () => void) => () => void
}

export function createStore<Value>(initial: Value): Store<Value> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: next => {
      if (Object.is(value, next)) {
        return
      }
      value = next
      for (const listener of listeners) {
        listener()
      }
    },
    subscribe: listener => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export function useStore<Value>(store: Store<Value>): Value {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

export type LinkOverlay = { anchor: OverlayAnchor; href: string; fresh: boolean }

export type CommandMenu = {
  anchor: OverlayAnchor
  items: readonly SlashCommand[]
  query: string
  index: number
  choose: (index: number) => void
}

export type TableAxis = 'row' | 'column'

export type CellAlign = 'left' | 'center' | 'right'

export type TableMenu = {
  anchor: HTMLElement
  axis: TableAxis
  index: number
  header: boolean
  align: CellAlign | null
}

export type EngineLabels = {
  selectRow: string
  selectColumn: string
  appendRow: string
  appendColumn: string
  dragBlock: string
  addBlock: string
  uploading: (percent: number) => string
  uploadFailed: string
  retryUpload: string
  dropUpload: string
}

export type HoveredBlock = { position: number; top: number; convertible: boolean }

export type BlockMenu = { anchor: HTMLElement; position: number; convertible: boolean }

export type BlockKind =
  'paragraph' | 'heading2' | 'heading3' | 'bulletList' | 'orderedList' | 'blockquote'

export type UploadedPicture = { src: string; width: number; height: number }

export type UploadOutcome = { ok: true; picture: UploadedPicture } | { ok: false; reason: string }

export type PictureUpload = (
  file: File,
  onProgress: (percent: number) => void,
) => Promise<UploadOutcome>

export type EditorSession = {
  link: Store<LinkOverlay | null>
  commands: Store<CommandMenu | null>
  tableMenu: Store<TableMenu | null>
  block: Store<HoveredBlock | null>
  blockMenu: Store<BlockMenu | null>
  uploading: Store<number>
  upload: Store<PictureUpload | undefined>
  resolvePicture: Store<(key: string) => string>
}

export function createSession(): EditorSession {
  return {
    link: createStore<LinkOverlay | null>(null),
    commands: createStore<CommandMenu | null>(null),
    tableMenu: createStore<TableMenu | null>(null),
    block: createStore<HoveredBlock | null>(null),
    blockMenu: createStore<BlockMenu | null>(null),
    uploading: createStore(0),
    upload: createStore<PictureUpload | undefined>(undefined),
    resolvePicture: createStore<(key: string) => string>(key => key),
  }
}
