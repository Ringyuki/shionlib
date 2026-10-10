import type { OverlayAnchor } from '@hina-ui/react'
import { useSyncExternalStore } from 'react'

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

export type EditorSession = { link: Store<LinkOverlay | null> }

export function createSession(): EditorSession {
  return { link: createStore<LinkOverlay | null>(null) }
}
