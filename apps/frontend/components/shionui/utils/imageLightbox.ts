'use client'

const isBrowser = typeof window !== 'undefined'

export const isMobile = () => {
  if (!isBrowser) return false
  return window.innerWidth < 1024
}

export const resolveOriginalSrc = (src: string) => {
  if (
    src.startsWith('http') ||
    src.includes('blob:') ||
    src.includes('data:image') ||
    src.includes('assets')
  ) {
    return src
  }

  const base = process.env.NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL ?? ''
  return `${base}${src}`
}

export const calculateTargetSize = (
  width: number,
  height: number,
  lightboxMaxSize: number,
  maxWidth: number,
) => {
  if (!isBrowser || width === 0 || height === 0) {
    return {
      width,
      height,
    }
  }

  const imageRatio = width / height
  const maxWidthValue = Math.min(window.innerWidth * lightboxMaxSize, maxWidth)
  const maxHeightValue = window.innerHeight * lightboxMaxSize

  let finalWidth = maxWidthValue
  let finalHeight = finalWidth / imageRatio

  if (finalHeight > maxHeightValue) {
    finalHeight = maxHeightValue
    finalWidth = finalHeight * imageRatio
  }

  return {
    width: finalWidth,
    height: finalHeight,
  }
}

export const loadImageDimensions = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () =>
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      })
    img.onerror = reject
    img.src = src
  })

export { isBrowser }
