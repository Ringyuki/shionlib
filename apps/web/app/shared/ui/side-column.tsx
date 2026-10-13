import { Affix, cn, Flex, ScrollArea } from '@hina-ui/react'
import type { ReactNode } from 'react'

export const sideOffset = 24

type SideColumnProps = {
  className?: string
  children: ReactNode
}

export function SideColumn({ className, children }: SideColumnProps) {
  return (
    <Affix offset={sideOffset} className={cn('lg:self-start', className)}>
      <ScrollArea className="-m-1 lg:max-h-[calc(100dvh-var(--hn-app-shell-header-h)-2.5rem)]">
        <Flex className="flex-col p-1">{children}</Flex>
      </ScrollArea>
    </Affix>
  )
}
