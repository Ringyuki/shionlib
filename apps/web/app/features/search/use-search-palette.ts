import { useEffect, useRef, useState } from 'react'
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
  const keepOpen = useRef(false)
  const query = normalizeQuery(search)
  const load = fetcher.load

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

  const changeOpen = (next: boolean) => {
    if (!next && keepOpen.current) {
      keepOpen.current = false
      return
    }
    keepOpen.current = false
    if (next) {
      setRecent(readRecent())
    }
    setOpen(next)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !editable(event.target)
      ) {
        event.preventDefault()
        setRecent(readRecent())
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const fill = (term: string) => {
    keepOpen.current = true
    setSearch(term)
  }

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
    keepOpen.current = true
    setRecent([])
    writeRecent([])
  }

  const palette = fetcher.data?.query === query ? fetcher.data : undefined

  return {
    open,
    setOpen: changeOpen,
    show: () => changeOpen(true),
    search,
    setSearch,
    query,
    palette,
    loading: palette === undefined,
    recent,
    fill,
    remember,
    settle,
    clearRecent,
  }
}
