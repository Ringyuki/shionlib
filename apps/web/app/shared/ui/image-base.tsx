import { createContext, useContext, type ReactNode } from 'react'
import { imageUrl } from './image-url'

const ImageBaseContext = createContext('')

export function ImageBaseProvider({ base, children }: { base: string; children: ReactNode }) {
  return <ImageBaseContext value={base}>{children}</ImageBaseContext>
}

export function useImageUrl() {
  const base = useContext(ImageBaseContext)
  return (key: string | null | undefined) => imageUrl(base, key)
}
