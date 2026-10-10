import { Image, Stack, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import type { Picture } from '~/shared/richtext/rich-text'

type PictureFigureProps = {
  picture: Picture
  zoomable?: boolean
  eager?: boolean
  caption?: ReactNode
  children?: ReactNode
}

export function PictureFigure({
  picture,
  zoomable = false,
  eager = false,
  caption,
  children,
}: PictureFigureProps) {
  const sized = picture.width > 0 && picture.height > 0
  const share = `${picture.widthPercent}%`
  return (
    <Stack
      as="figure"
      gap="sm"
      align="center"
      className="mx-auto my-4 max-w-full"
      style={{ width: sized ? `min(${share}, ${picture.width}px)` : share }}
    >
      <Stack gap="none" data-picture-frame="" className="group/picture relative w-full rounded-lg">
        <Image
          src={picture.src}
          alt={picture.alt}
          ratio={sized ? picture.width / picture.height : undefined}
          preview={zoomable}
          previewSize={sized ? { width: picture.width, height: picture.height } : undefined}
          lazy={!eager}
          draggable={false}
          className="w-full rounded-lg"
        />
        {children}
      </Stack>
      {caption ??
        (picture.caption !== '' && (
          <Text as="figcaption" size="sm" tone="muted" className="text-center">
            {picture.caption}
          </Text>
        ))}
    </Stack>
  )
}
