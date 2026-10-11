import { useState } from 'react'
import { href, useFetcher } from 'react-router'
import { useLazyLoad } from '~/shared/route/use-lazy-load'
import type { Opened } from './inspection-preview'
import type { textPreviewLoader } from './inspection.server'

export function usePreviews() {
  const texts = useLazyLoad(useFetcher<typeof textPreviewLoader>())
  const [opened, setOpened] = useState<Opened>()
  const [shown, setShown] = useState<'text' | 'image'>()
  const [index, setIndex] = useState(0)
  const { load } = texts
  const open = (next: Opened) => {
    setOpened(next)
    if (next.entry.preview === 'text') {
      setShown('text')
      void load(`${href('/resources/inspection/text')}?entry=${next.entry.id}`)
      return
    }
    setIndex(
      Math.max(
        0,
        next.images.findIndex(image => image.id === next.entry.id),
      ),
    )
    setShown('image')
  }
  const text = texts.result?.id === opened?.entry.id ? texts.result : undefined
  return {
    opened,
    open,
    close: () => setShown(undefined),
    text: { open: shown === 'text', preview: text, loading: texts.loading },
    image: { open: shown === 'image', index, setIndex },
  }
}
