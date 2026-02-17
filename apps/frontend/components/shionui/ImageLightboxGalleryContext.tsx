'use client'

import * as React from 'react'

export interface LightboxGroupItem {
  id: string
  src: string
  alt?: string
  aspectRatio?: string
  lightboxMaxSize: number
  maxWidth: number
  getContainer: () => HTMLElement | null
  getImage: () => HTMLImageElement | null
}

export interface ImageLightboxGalleryContextValue {
  registerItem: (item: LightboxGroupItem) => () => void
  openItem: (id: string) => void
  activeItemId: string | null
}

export const ImageLightboxGalleryContext =
  React.createContext<ImageLightboxGalleryContextValue | null>(null)
