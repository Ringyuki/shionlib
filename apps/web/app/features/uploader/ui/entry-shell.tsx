import { Grid, Inline, Stack } from '@hina-ui/react'
import type { ElementType, ReactNode } from 'react'

type EntryShellProps = {
  as: ElementType
  label?: string
  files: ReactNode
  stage: ReactNode
  controls: ReactNode
  controlSlots: 0 | 1 | 2
  notice?: ReactNode
  facts: ReactNode
}

const spare = { 0: 'pe-16', 1: 'pe-7', 2: '' } as const

export function EntryShell({
  as,
  label,
  files,
  stage,
  controls,
  controlSlots,
  notice,
  facts,
}: EntryShellProps) {
  return (
    <Grid
      as={as}
      aria-label={label}
      className="grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5"
    >
      <Stack as="ul" gap="xs" className={`m-0 min-w-0 list-none p-0 ${spare[controlSlots]}`}>
        {files}
      </Stack>
      <Inline gap="sm" align="center" wrap={false} className="min-h-7">
        {stage}
        {controls}
      </Inline>
      {notice}
      <Inline gap="md" align="center" className="col-span-2 gap-y-1 ps-6">
        {facts}
      </Inline>
    </Grid>
  )
}
