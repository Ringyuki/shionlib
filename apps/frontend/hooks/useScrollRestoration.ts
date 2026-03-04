'use client'

import { useEffect, useRef, useState } from 'react'

interface CachedState<T, M> {
  items: T[]
  meta: M
  scrollY: number
  timestamp: number
}

interface UseScrollRestorationOptions<T, M> {
  key: string
  initialItems: T[]
  initialMeta: M
  /** Cache TTL in milliseconds. Defaults to 10 minutes. */
  ttl?: number
}

function readCache<T, M>(key: string, ttl: number): CachedState<T, M> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const cached = JSON.parse(raw) as CachedState<T, M>
    if (Date.now() - cached.timestamp > ttl) {
      sessionStorage.removeItem(key)
      return null
    }
    return cached
  } catch {
    return null
  }
}

export function useScrollRestoration<T, M>({
  key,
  initialItems,
  initialMeta,
  ttl = 10 * 60 * 1000,
}: UseScrollRestorationOptions<T, M>) {
  const [initialCached] = useState<CachedState<T, M> | null>(() => readCache(key, ttl))

  const [items, setItems] = useState<T[]>(initialCached?.items ?? initialItems)
  const [meta, setMeta] = useState<M>(initialCached?.meta ?? initialMeta)

  const itemsRef = useRef(items)
  itemsRef.current = items
  const metaRef = useRef(meta)
  metaRef.current = meta

  // Restore scroll position after the restored items are painted.
  // initialCached is from useState — its reference is stable, so this runs only once.
  useEffect(() => {
    if (!initialCached?.scrollY) return
    const scrollY = initialCached.scrollY
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'instant' })
    })
  }, [initialCached])

  // Persist state to sessionStorage on unmount.
  useEffect(() => {
    return () => {
      try {
        const state: CachedState<T, M> = {
          items: itemsRef.current,
          meta: metaRef.current,
          scrollY: window.scrollY,
          timestamp: Date.now(),
        }
        sessionStorage.setItem(key, JSON.stringify(state))
      } catch {
        // sessionStorage may be unavailable or full.
      }
    }
  }, [key])

  return { items, setItems, meta, setMeta }
}
