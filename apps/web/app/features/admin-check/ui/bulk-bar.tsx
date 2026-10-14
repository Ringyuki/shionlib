import { Inline, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'

type BulkBarProps = {
  count: number
  onClear: () => void
  children: ReactNode
}

export function BulkBar({ count, onClear, children }: BulkBarProps) {
  const shared = useTranslations('admin')
  return (
    <Inline gap="sm" align="center" wrap={false}>
      <Text as="span" size="sm" weight="medium" className="whitespace-nowrap">
        {shared('selected', { count })}
      </Text>
      {children}
      <Button size="sm" variant="ghost" tone="neutral" onClick={onClear}>
        {shared('clearSelection')}
      </Button>
    </Inline>
  )
}
