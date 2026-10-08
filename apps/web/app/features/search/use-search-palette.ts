import { useEffect, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { readLocal, writeLocal } from '~/shared/storage/local-storage'
import { normalizeQuery, recentStorageKey, rememberSearch, searchDelayMs } from './search'
import { parseRecent, type RecordSearch } from './search.schema'
import type { recordSearchAction } from './search.server'
import type { PaletteSource } from './use-palette-source'

const readRecent = () => readLocal(recentStorageKey, parseRecent)

const writeRecent = (recent: readonly string[]) => writeLocal(recentStorageKey, recent)

export function useSearchPalette(source: PaletteSource, close: () => void) {
  const recorder = useFetcher<typeof recordSearchAction>()
  const [search, setSearch] = useState('')
  const [recent, setRecent] = useState(readRecent)
  const query = normalizeQuery(search)
  const { load } = source

  useEffect(() => {
    const timer = window.setTimeout(() => load(query), query === '' ? 0 : searchDelayMs)
    return () => window.clearTimeout(timer)
  }, [query, load])

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

  return {
    close,
    search,
    setSearch,
    query,
    palette: source.of(query),
    recent,
    fill,
    remember,
    settle,
    clearRecent,
  }
}
