import { useCallback, useEffect, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { readLocal, writeLocal } from '~/shared/storage/local-storage'
import { normalizeQuery, recentStorageKey, rememberSearch, searchDelayMs } from './search'
import { parseRecent, type RecordSearch } from './search.schema'
import type { paletteLoader, recordSearchAction } from './search.server'

const readRecent = () => readLocal(recentStorageKey, parseRecent)

const writeRecent = (recent: readonly string[]) => writeLocal(recentStorageKey, recent)

function editable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

export function useSearchPalette() {
  const fetcher = useFetcher<typeof paletteLoader>()
  const recorder = useFetcher<typeof recordSearchAction>()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const [idle, setIdle] = useState(fetcher.data)
  const query = normalizeQuery(search)
  const load = fetcher.load
  const loaded = fetcher.data
  if (loaded !== undefined && loaded.query === '' && loaded !== idle) {
    setIdle(loaded)
  }

  useEffect(() => {
    if (!open) {
      return
    }
    const timer = window.setTimeout(
      () => void load(`${href('/resources/search')}?${new URLSearchParams({ q: query })}`),
      query === '' ? 0 : searchDelayMs,
    )
    return () => window.clearTimeout(timer)
  }, [open, query, load])

  const show = useCallback(() => {
    setRecent(readRecent())
    setSearch('')
    setOpen(true)
  }, [])

  const changeOpen = (next: boolean) => {
    if (next) {
      show()
    } else {
      setOpen(false)
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const modified = event.metaKey || event.ctrlKey
      const slash = event.key === '/' && !modified && !event.altKey && !editable(event.target)
      const modK = event.key.toLowerCase() === 'k' && modified && !event.altKey && !event.shiftKey
      if (slash || modK) {
        event.preventDefault()
        if (!open) {
          show()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, show])

  const fill = (term: string) => setSearch(term)

  const remember = () => {
    const next = rememberSearch(recent, query)
    setRecent(next)
    writeRecent(next)
  }

  const settle = () => {
    if (query === '') {
      return
    }
    remember()
    const record: RecordSearch = { query }
    void recorder.submit(record, {
      method: 'post',
      action: href('/resources/search'),
      encType: 'application/json',
    })
  }

  const clearRecent = () => {
    setRecent([])
    writeRecent([])
  }

  const palette = loaded?.query === query ? loaded : query === '' ? idle : undefined

  return {
    open,
    setOpen: changeOpen,
    show,
    search,
    setSearch,
    query,
    palette,
    recent,
    fill,
    remember,
    settle,
    clearRecent,
  }
}
