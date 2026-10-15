import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { imageSearchAction } from './search.server'
import { cropsOf, shotOf } from './search-crops'
import { pastedImage, urlsOf, type ImageSearch } from './search-image'

function revoke(urls: Iterable<string>) {
  for (const url of urls) {
    URL.revokeObjectURL(url)
  }
}

export function useImageSearch() {
  const command = useCommand(
    useFetcher<typeof imageSearchAction>(),
    href('/resources/search/image'),
    {
      multipart: true,
      revalidate: false,
    },
  )
  const [search, setSearch] = useState<ImageSearch>({ phase: 'off' })
  const turn = useRef(0)
  const owned = useRef(new Set<string>())

  useEffect(() => {
    const kept = new Set(urlsOf(search))
    revoke([...owned.current].filter(url => !kept.has(url)))
    owned.current = kept
  }, [search])

  useEffect(() => {
    const held = owned
    return () => revoke(held.current)
  }, [])

  const move = (next: ImageSearch) => {
    turn.current += 1
    setSearch(next)
  }

  const choose = async (file: File) => {
    turn.current += 1
    const mine = turn.current
    const shot = await shotOf(file)
    if (mine !== turn.current) {
      revoke([shot.src])
      return
    }
    setSearch({ phase: 'reading', shot })
    const form = new FormData()
    form.append('image', file)
    const outcome = await command.run(form)
    if (mine !== turn.current) {
      return
    }
    if (!outcome.ok) {
      setSearch({ phase: 'choosing' })
      return
    }
    const crops = await cropsOf(
      file,
      (outcome.result.characters ?? []).map(found => found.box),
    )
    if (mine !== turn.current) {
      revoke(crops.filter(url => url !== ''))
      return
    }
    setSearch({ phase: 'done', shot, findings: outcome.result, crops })
  }

  const paste = useEffectEvent((event: ClipboardEvent) => {
    const file = pastedImage(event.clipboardData?.items ?? [])
    if (file !== undefined) {
      event.preventDefault()
      void choose(file)
    }
  })

  useEffect(() => {
    const listen = (event: ClipboardEvent) => paste(event)
    document.addEventListener('paste', listen)
    return () => document.removeEventListener('paste', listen)
  }, [])

  return {
    search,
    on: search.phase !== 'off',
    choose: (file: File) => void choose(file),
    open: () => move({ phase: 'choosing' }),
    close: () => move({ phase: 'off' }),
  }
}

export type ImageSearchControl = ReturnType<typeof useImageSearch>
