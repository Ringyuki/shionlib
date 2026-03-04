'use client'

import { create } from 'zustand'

interface ScrollRestorationEntry {
  items: unknown[]
  meta: unknown
  scrollY: number
}

interface ScrollRestorationStore {
  cache: Map<string, ScrollRestorationEntry>
  set: (key: string, entry: ScrollRestorationEntry) => void
  get: (key: string) => ScrollRestorationEntry | undefined
}

export const useScrollRestorationStore = create<ScrollRestorationStore>()((set, get) => ({
  cache: new Map(),
  set: (key, entry) =>
    set(state => {
      const next = new Map(state.cache)
      next.set(key, entry)
      return { cache: next }
    }),
  get: key => get().cache.get(key),
}))
