import { useEffect, useEffectEvent } from 'react'
import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import type { NameReading } from './resource-name'
import type { nameReadingLoader } from './resource.server'

export function useNameReading(
  fileName: string | undefined,
  onRead: (reading: NameReading) => void,
) {
  const { load, result } = useLazyLoad(useFetcher<typeof nameReadingLoader>())
  const read = useEffectEvent(onRead)
  useEffect(() => {
    if (fileName !== undefined) {
      void load(
        `${href('/resources/resource/name-read')}?${new URLSearchParams({ name: fileName })}`,
      )
    }
  }, [fileName, load])
  useEffect(() => {
    if (result !== undefined) {
      read(result)
    }
  }, [result])
}
