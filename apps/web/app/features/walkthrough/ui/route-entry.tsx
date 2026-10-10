import { cn, Flex, Text } from '@hina-ui/react'
import { Lock } from 'lucide-react'
import { useTranslations } from 'use-intl'
import type { Portrait } from '../walkthrough'
import { RouteFaces } from './route-faces'

type RouteEntryProps = {
  ordinal?: number
  name: string
  portraits: readonly Portrait[]
  active: boolean
  conditioned: boolean
  locks: boolean
  roomy?: boolean
}

export function entrySurface(active: boolean, className?: string): string {
  return cn(
    'hn-state-layer rounded-lg',
    active ? 'bg-accent-soft text-accent-text' : 'text-fg',
    className,
  )
}

export function entryRow(active: boolean, className: string): string {
  return entrySurface(active, cn('hn-interactive items-center gap-3 px-3 text-start', className))
}

export function RouteEntry(props: RouteEntryProps) {
  const { ordinal, name, portraits, active, conditioned, locks, roomy = false } = props
  const t = useTranslations('walkthrough')
  const size = roomy ? 'base' : 'sm'
  return (
    <>
      {ordinal !== undefined && (
        <Text
          as="span"
          size={size}
          className={cn('w-5 shrink-0 text-center tabular-nums', active && 'text-inherit')}
          tone="muted"
        >
          {ordinal}
        </Text>
      )}
      <Text as="span" size={size} weight="medium" className="min-w-0 flex-1 text-inherit">
        {name === '' ? t('unnamed') : name}
      </Text>
      <RouteFaces portraits={portraits} />
      {locks && (
        <Flex as="span" className="size-4 shrink-0">
          {conditioned && (
            <Lock aria-label={t('conditioned')} className={cn('size-4', !active && 'text-muted')} />
          )}
        </Flex>
      )}
    </>
  )
}
