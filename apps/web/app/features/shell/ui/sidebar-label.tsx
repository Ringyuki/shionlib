import { cn, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'

type SidebarLabelProps = {
  collapsed: boolean
  className?: string
  children: ReactNode
}

export function SidebarLabel({ collapsed, className, children }: SidebarLabelProps) {
  return (
    <Text
      as="span"
      size="inherit"
      aria-hidden={collapsed || undefined}
      inert={collapsed}
      data-collapsed={collapsed ? '' : undefined}
      className={cn('hn-sidebar-label min-w-0 truncate text-inherit', className)}
    >
      {children}
    </Text>
  )
}
