import { Center, Image, Inline, Stack, Tag, Text } from '@hina-ui/react'
import { Building2, Gamepad2, UserRound } from 'lucide-react'
import { GamePicture } from '~/features/game'
import type { Picture, PictureShape } from '../search'

type PictureOptionProps = {
  name: string
  detail: string | undefined
  picture: Picture
  note?: string
}

const frames = {
  cover: { ratio: 3 / 4, fit: 'cover', imageClass: undefined, icon: Gamepad2 },
  portrait: { ratio: 3 / 4, fit: 'cover', imageClass: 'object-top', icon: UserRound },
  logo: { ratio: 1, fit: 'contain', imageClass: undefined, icon: Building2 },
} as const satisfies Record<PictureShape, unknown>

const frameClass = 'bg-inset w-9 shrink-0 rounded-sm'

export function PictureOption({ name, detail, picture, note }: PictureOptionProps) {
  const frame = frames[picture.shape]
  const Icon = frame.icon
  const empty = (
    <Center className="text-muted size-full">
      <Icon aria-hidden className="size-4" />
    </Center>
  )
  return (
    <Inline as="span" gap="sm" align="center" wrap={false}>
      {picture.shape === 'cover' ? (
        <GamePicture
          picture={picture.cover}
          ratio={frame.ratio}
          fit={frame.fit}
          className={frameClass}
          empty={empty}
        />
      ) : (
        <Image
          src={picture.src}
          thumbhash={picture.thumbhash}
          alt=""
          ratio={frame.ratio}
          fit={frame.fit}
          imageClass={frame.imageClass}
          className={frameClass}
          empty={empty}
        />
      )}
      <Stack as="span" gap="none" className="min-w-0">
        <Inline as="span" gap="xs" align="center" wrap={false}>
          <Text as="span" size="sm" weight="medium" truncate>
            {name}
          </Text>
          {note !== undefined && (
            <Tag size="sm" tone="warning" className="shrink-0">
              {note}
            </Tag>
          )}
        </Inline>
        {detail !== undefined && detail !== '' && (
          <Text as="span" size="xs" tone="muted" truncate>
            {detail}
          </Text>
        )}
      </Stack>
    </Inline>
  )
}
