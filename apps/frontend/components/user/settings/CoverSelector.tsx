'use client'

import { useState } from 'react'
import { CoverResize } from './CoverResize'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { ImageIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface CoverSelectorProps {
  cover: string
  onUpdate: (image: string) => void
}

export const CoverSelector = ({ cover, onUpdate }: CoverSelectorProps) => {
  const [image, setImage] = useState<File>(new File([], ''))
  const [croppedImage, setCroppedImage] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      setOpen(true)
    }
  }

  const handleCrop = (cropped: string | null) => {
    setCroppedImage(cropped)
    onUpdate(cropped ?? '')
  }

  const src =
    croppedImage ||
    (cover
      ? cover.startsWith('http')
        ? cover
        : process.env.NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL + cover
      : '')

  return (
    <>
      <div
        className={cn(
          'relative md:aspect-3/1 aspect-square w-16 sm:w-24 md:w-64 rounded-md overflow-hidden hover:cursor-pointer hover:bg-primary/10 transition-colors select-none',
          !src && 'border border-primary/60 border-dashed',
          src && 'hover:opacity-80 transition-opacity',
        )}
        onClick={() => document.getElementById('cover-input')?.click()}
      >
        {src ? (
          <FadeImage src={src} alt="" fill imageClassName="object-cover" />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <ImageIcon className="md:size-8 size-6 text-primary/60" />
          </div>
        )}
      </div>
      <input
        className="hidden"
        type="file"
        accept="image/*"
        id="cover-input"
        onClick={e => ((e.target as HTMLInputElement).value = '')}
        onChange={handleImageSelect}
      />
      <CoverResize image={image} open={open} setOpen={setOpen} onCrop={handleCrop} />
    </>
  )
}
