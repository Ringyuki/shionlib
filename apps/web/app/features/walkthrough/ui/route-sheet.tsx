import { cn, Flex, Sheet, Stack, Text } from '@hina-ui/react'
import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import type { Portrait } from '../walkthrough'
import { RouteFaces } from './route-faces'

type RouteSheetProps = {
  name: string
  portraits: readonly Portrait[]
  ordinal: number
  count: number
  className?: string
  renderRoutes: (close: () => void) => ReactNode
}

export function RouteSheet(props: RouteSheetProps) {
  const { name, portraits, ordinal, count, className, renderRoutes } = props
  const t = useTranslations('walkthrough')
  return (
    <Sheet title={t('routes')} renderContent={({ close }) => renderRoutes(close)}>
      <Flex
        as="button"
        className={cn(
          'hn-interactive hn-state-layer border-line-strong bg-surface min-h-13 w-full',
          'items-center gap-3 rounded-lg border px-3 py-2 text-start',
          className,
        )}
      >
        <Stack as="span" gap="none" className="min-w-0 flex-1">
          <Text as="span" weight="medium">
            {name === '' ? t('unnamed') : name}
          </Text>
          <Text as="span" size="xs" tone="muted">
            {t('position', { ordinal, count })}
          </Text>
        </Stack>
        <RouteFaces portraits={portraits} />
        <ChevronDown aria-hidden className="text-muted size-4 shrink-0" />
      </Flex>
    </Sheet>
  )
}
