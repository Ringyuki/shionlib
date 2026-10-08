import { useEffect, useState } from 'react'

function editable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

export function usePaletteOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onKey = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) {
        return
      }
      const modified = event.metaKey || event.ctrlKey
      const slash = event.key === '/' && !modified && !event.altKey && !editable(event.target)
      const modK = event.key.toLowerCase() === 'k' && modified && !event.altKey && !event.shiftKey
      if (slash || modK) {
        event.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  return { open, setOpen }
}
