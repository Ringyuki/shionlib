import { Divider, Flex, Stack, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'

type SidebarGroupProps = {
  label: string
  rail: boolean
  children: ReactNode
}

export function SidebarGroup({ label, rail, children }: SidebarGroupProps) {
  return (
    <Stack gap="xs" role="group" aria-label={label}>
      <Flex align="center" className="relative h-6">
        <Text
          as="span"
          size="xs"
          weight="medium"
          tone="faint"
          aria-hidden={rail || undefined}
          data-collapsed={rail ? '' : undefined}
          className="hn-sidebar-label px-3 whitespace-nowrap"
        >
          {label}
        </Text>
        <Divider
          aria-hidden
          data-collapsed={rail ? undefined : ''}
          className="hn-sidebar-label pointer-events-none absolute inset-x-2 top-1/2 w-auto"
        />
      </Flex>
      {children}
    </Stack>
  )
}
