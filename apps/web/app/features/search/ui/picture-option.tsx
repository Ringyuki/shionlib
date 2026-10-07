import { Center, Image, Inline, Stack, Text } from '@hina-ui/react'
import { Building2, Gamepad2, UserRound } from 'lucide-react'
import type { Picture, PictureShape } from '../search'

type PictureOptionProps = {
  name: string
  detail: string | undefined
  picture: Picture
}

const frames = {
  cover: { ratio: 3 / 4, fit: 'cover', imageClass: undefined, icon: Gamepad2 },
  portrait: { ratio: 3 / 4, fit: 'cover', imageClass: 'object-top', icon: UserRound },
  logo: { ratio: 1, fit: 'contain', imageClass: undefined, icon: Building2 },
} as const satisfies Record<PictureShape, unknown>

export function PictureOption({ name, detail, picture }: PictureOptionProps) {
  const frame = frames[picture.shape]
  const Icon = frame.icon
  return (
    <Inline as="span" gap="sm" align="center" wrap={false}>
      <Image
        src={picture.src}
        alt=""
        ratio={frame.ratio}
        fit={frame.fit}
        imageClass={frame.imageClass}
        className="bg-inset w-9 shrink-0 rounded-sm"
        empty={
          <Center className="text-muted size-full">
            <Icon aria-hidden className="size-4" />
          </Center>
        }
      />
      <Stack as="span" gap="none" className="min-w-0">
        <Text as="span" size="sm" weight="medium" truncate>
          {name}
        </Text>
        {detail !== undefined && detail !== '' && (
          <Text as="span" size="xs" tone="muted" truncate>
            {detail}
          </Text>
        )}
      </Stack>
    </Inline>
  )
}
