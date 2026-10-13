import { Affix, Inline, Stack, Text } from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'

type BottomBarProps = {
  total: string
  children: ReactNode
}

export function BottomBar({ total, children }: BottomBarProps) {
  const t = useTranslations('sponsor.summary')
  return (
    <Affix
      position="bottom"
      className="bg-canvas border-line -mx-4 mt-auto border-t px-4 py-3 sm:-mx-6 sm:px-6 lg:hidden"
    >
      <Inline gap="md" justify="between" align="center" wrap={false}>
        <Stack gap="none">
          <Text size="xs" tone="muted">
            {t('due')}
          </Text>
          <Text weight="semibold" className="text-lg tabular-nums">
            {total}
          </Text>
        </Stack>
        {children}
      </Inline>
    </Affix>
  )
}
