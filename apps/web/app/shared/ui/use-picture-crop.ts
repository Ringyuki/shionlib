import { useEffect, useRef, useState } from 'react'

export type Picture = { name: string; url: string }

export function usePictureCrop() {
  const [picture, setPicture] = useState<Picture | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const held = useRef<string | undefined>(undefined)
  useEffect(
    () => () => {
      if (held.current !== undefined) {
        URL.revokeObjectURL(held.current)
      }
    },
    [],
  )
  const pick = (file: File) => {
    if (held.current !== undefined) {
      URL.revokeObjectURL(held.current)
    }
    const url = URL.createObjectURL(file)
    held.current = url
    setPicture({ name: file.name, url })
    setOpen(true)
  }
  return { picture, open, onOpenChange: setOpen, pick }
}
