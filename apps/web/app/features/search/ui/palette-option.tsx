import { Inline, Stack, Text } from '@hina-ui/react'
import type { PaletteEntry } from '../use-palette-entries'
import { PictureOption } from './picture-option'

export function PaletteOption({ entry }: { entry: PaletteEntry }) {
  if (entry.kind === 'picture') {
    return (
      <PictureOption
        name={entry.label}
        detail={entry.description}
        picture={entry.picture}
        note={entry.note}
      />
    )
  }
  const Icon = entry.icon
  return (
    <Inline as="span" gap="sm" align="center" wrap={false}>
      <Icon aria-hidden className="shrink-0 text-muted" />
      <Stack as="span" gap="none" className="min-w-0">
        <Text as="span" size="sm" truncate>
          {entry.label}
        </Text>
        {entry.description !== undefined && (
          <Text as="span" size="xs" tone="muted" truncate>
            {entry.description}
          </Text>
        )}
      </Stack>
    </Inline>
  )
}
