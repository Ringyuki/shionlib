import { Inline, Stack, Text } from '@hina-ui/react'
import { FileArchive } from 'lucide-react'
import type { ReactNode } from 'react'

type FileLineProps = {
  name: string
  size: string
  state?: ReactNode
  bar?: ReactNode
}

export function FileLine({ name, size, state, bar }: FileLineProps) {
  return (
    <Stack as="li" gap="none" className="gap-0.5">
      <Inline gap="sm" align="start" wrap={false}>
        <FileArchive aria-hidden className="mt-1.5 size-4 shrink-0 text-muted" />
        <Inline gap="sm" align="center" className="min-h-7 min-w-0 gap-y-0.5">
          <Text weight="medium" className="max-w-full break-words">
            {name}
          </Text>
          <Text size="sm" tone="muted" className="whitespace-nowrap tabular-nums">
            {size}
          </Text>
          {state !== undefined && (
            <Inline align="center" className="min-h-5.5 w-28 shrink-0">
              {state}
            </Inline>
          )}
        </Inline>
      </Inline>
      <Stack gap="none" className="h-1 ps-6">
        {bar}
      </Stack>
    </Stack>
  )
}
