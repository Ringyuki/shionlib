import { useEffect, useEffectEvent } from 'react'
import { href, useFetcher } from 'react-router'
import type { ListCreation } from './favorite.schema'
import type { createFavoriteListAction } from './favorite.server'

export function useCreateList(onCreated: (name: string) => void) {
  const fetcher = useFetcher<typeof createFavoriteListAction>()
  const created = useEffectEvent(onCreated)
  const settled = fetcher.state === 'idle' ? fetcher.data : undefined
  useEffect(() => {
    if (settled?.ok === true) {
      created(settled.result.name)
    }
  }, [settled])
  const submit = (creation: ListCreation) =>
    fetcher.submit(creation, {
      method: 'post',
      action: href('/resources/favorites/lists'),
      encType: 'application/json',
    })
  return {
    submit,
    pending: fetcher.state !== 'idle',
    failure: fetcher.data?.ok === false ? fetcher.data.failure : undefined,
  }
}
