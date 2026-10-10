import { Textarea } from '@hina-ui/react'
import { useEffect, useState } from 'react'
import { captionLimits } from '~/shared/richtext/rich-text.schema'

type PictureCaptionProps = {
  stored: string
  label: string
  hint: string
  onChange: (caption: string) => void
}

const typingPause = 400

export function PictureCaption({ stored, label, hint, onChange }: PictureCaptionProps) {
  const [typed, setTyped] = useState<string | undefined>(undefined)
  const caption = typed ?? stored
  const commit = () => {
    const written = caption.trim()
    setTyped(undefined)
    if (written !== stored) {
      onChange(written)
    }
  }
  useEffect(() => {
    if (typed === undefined) {
      return
    }
    const timer = window.setTimeout(() => {
      const written = typed.trim()
      if (written !== stored) {
        onChange(written)
      }
    }, typingPause)
    return () => window.clearTimeout(timer)
  })
  return (
    <Textarea
      variant="bare"
      autosize
      rows={1}
      aria-label={label}
      placeholder={hint}
      maxLength={captionLimits.caption}
      value={caption}
      onValueChange={setTyped}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
      className="text-muted w-full text-sm font-normal [--hn-textarea-px:0px]"
    />
  )
}
