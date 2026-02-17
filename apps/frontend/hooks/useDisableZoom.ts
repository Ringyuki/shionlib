import { useEffect } from 'react'

export function useDisableZoom(enabled = true) {
  useEffect(() => {
    if (!enabled) return

    let meta = document.querySelector('meta[name="viewport"]')
    const createdMeta = !meta

    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'viewport')
      document.head.appendChild(meta)
    }

    const metaElement = meta
    const originalContent = metaElement.getAttribute('content') ?? ''

    metaElement.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
    )

    return () => {
      if (!metaElement) return
      if (originalContent) {
        metaElement.setAttribute('content', originalContent)
      } else if (createdMeta) {
        metaElement.remove()
      } else {
        metaElement.removeAttribute('content')
      }
    }
  }, [enabled])
}
