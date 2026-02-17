'use client'

import { Avatar, AvatarImage, AvatarFallback } from '@/components/shionui/Avatar'
import { useState } from 'react'
import { AvatarResize } from './AvatarResize'

interface AvatarSelectorProps {
  avatar: string
  name: string
  onUpdate: (image: string) => void
}

export const AvatarSelector = ({ avatar, name, onUpdate }: AvatarSelectorProps) => {
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
  const handleCrop = (croppedImage: string | null) => {
    setCroppedImage(croppedImage)
    onUpdate(croppedImage ?? '')
  }

  return (
    <>
      <Avatar
        className="size-12 select-none hover:cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => document.getElementById('avatar-input')?.click()}
      >
        <AvatarImage
          src={
            croppedImage ||
            (avatar
              ? avatar.startsWith('http')
                ? avatar
                : process.env.NEXT_PUBLIC_SHIONLIB_IMAGE_BED_URL + avatar
              : '')
          }
          className="bg-primary/20"
        />
        {!avatar && (
          <AvatarFallback className="bg-primary/20">
            {name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        )}
      </Avatar>
      <input
        className="hidden"
        type="file"
        accept="image/*"
        id="avatar-input"
        onClick={e => ((e.target as HTMLInputElement).value = '')}
        onChange={handleImageSelect}
      />
      <AvatarResize image={image} open={open} setOpen={setOpen} onCrop={handleCrop} />
    </>
  )
}
