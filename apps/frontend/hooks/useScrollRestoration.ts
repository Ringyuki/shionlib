'use client'

import { useEffect, useRef, useState } from 'react'
import { useScrollRestorationStore } from '@/store/scrollRestorationStore'

interface UseScrollRestorationOptions<T, M> {
  key: string
  initialItems: T[]
  initialMeta: M
}

export function useScrollRestoration<T, M>({
  key,
  initialItems,
  initialMeta,
}: UseScrollRestorationOptions<T, M>) {
  const storeGet = useScrollRestorationStore(s => s.get)
  const storeSet = useScrollRestorationStore(s => s.set)

  const [initialCached] = useState(() => storeGet(key))

  const [items, setItems] = useState<T[]>((initialCached?.items as T[]) ?? initialItems)
  const [meta, setMeta] = useState<M>((initialCached?.meta as M) ?? initialMeta)

  const itemsRef = useRef(items)
  itemsRef.current = items
  const metaRef = useRef(meta)
  metaRef.current = meta

  // Restore scroll position after the restored items are painted.
  useEffect(() => {
    if (!initialCached?.scrollY) return
    const scrollY = initialCached.scrollY
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'instant' })
    })
  }, [initialCached])

  // Persist state to store on unmount.
  useEffect(() => {
    return () => {
      storeSet(key, {
        items: itemsRef.current as unknown[],
        meta: metaRef.current,
        scrollY: window.scrollY,
      })
    }
  }, [key, storeSet])

  return { items, setItems, meta, setMeta }
}
