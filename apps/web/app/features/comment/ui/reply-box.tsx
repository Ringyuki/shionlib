import { cn, Collapsible, CollapsibleContent, Stack } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { shownOnceOpen } from './thread-motion'

type ReplyBoxProps = {
  open: boolean
  className: string
  children: ReactNode
}

export function ReplyBox({ open, className, children }: ReplyBoxProps) {
  return (
    <Collapsible open={open}>
      <CollapsibleContent className={cn('-mx-1 px-1', shownOnceOpen)}>
        <Stack gap="none" className={className}>
          {children}
        </Stack>
      </CollapsibleContent>
    </Collapsible>
  )
}
