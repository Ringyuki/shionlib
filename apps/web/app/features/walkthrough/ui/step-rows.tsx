import { cn, Flex, Inline, Link, Stack, Tag, Text } from '@hina-ui/react'
import { Flag, FolderOpen, Save } from 'lucide-react'
import type { ReactNode, Ref } from 'react'
import { Link as RouterLink } from 'react-router'
import { useTranslations } from 'use-intl'
import { useAimed } from '~/shared/route/use-aimed'
import { saveAnchor, type Linked, type Row } from '../walkthrough'

type StepRowsProps = {
  rows: readonly Row[]
  sourceHref?: (source: Linked, slot: string) => string
}

const marker = 'w-6 shrink-0 justify-end'

export function StepRows({ rows, sourceHref }: StepRowsProps) {
  const t = useTranslations('walkthrough')
  return (
    <Stack as="ol" gap="none" aria-label={t('steps')}>
      {rows.map((row, index) => (
        <StepRow key={index} row={row} sourceHref={sourceHref} />
      ))}
    </Stack>
  )
}

type StepRowProps = Pick<StepRowsProps, 'sourceHref'> & { row: Row }

function StepRow({ row, sourceHref }: StepRowProps) {
  const t = useTranslations('walkthrough')
  switch (row.kind) {
    case 'gap':
      return <Flex as="li" aria-hidden className="h-4" />
    case 'note':
      return (
        <Line>
          <Text as="span" size="sm" tone="muted" className="ps-9.5">
            {row.text}
          </Text>
        </Line>
      )
    case 'choice':
      return (
        <Line>
          <Text as="span" size="xs" tone="muted" className={cn(marker, 'text-end tabular-nums')}>
            {row.number}
          </Text>
          <Inline as="span" gap="none" align="center" className="min-w-0 gap-x-2.5 gap-y-1">
            <Text as="span">{row.text}</Text>
            {row.remark !== '' && <Tag variant="outline">{row.remark}</Tag>}
          </Inline>
        </Line>
      )
    case 'save':
      return <SaveRow slot={row.slot} />
    case 'load':
      return (
        <Line icon={<FolderOpen />}>
          <Inline as="span" gap="none" align="center" className="min-w-0 gap-x-2.5 gap-y-1">
            <Text as="span">{t('load', { slot: row.slot })}</Text>
            {row.source !== undefined && (
              <Source source={row.source} href={sourceHref?.(row.source, row.slot)} />
            )}
          </Inline>
        </Line>
      )
    case 'ending':
      return (
        <Line icon={<Flag />}>
          <Text as="span" weight="medium">
            {row.text}
          </Text>
        </Line>
      )
  }
}

function SaveRow({ slot }: { slot: string }) {
  const t = useTranslations('walkthrough')
  const anchor = saveAnchor(slot)
  const { entry, focused } = useAimed(hash => hash === `#${anchor}`)
  return (
    <Line ref={entry} id={anchor} icon={<Save />} tinted={focused}>
      <Text as="span">{t('save', { slot })}</Text>
    </Line>
  )
}

function Source({ source, href }: { source: Linked; href: string | undefined }) {
  const t = useTranslations('walkthrough')
  const label = t('savedIn', { route: source.name === '' ? t('unnamed') : source.name })
  if (href === undefined) {
    return (
      <Text as="span" size="sm" tone="muted">
        {label}
      </Text>
    )
  }
  return (
    <Text as="span" size="sm">
      <Link asChild>
        <RouterLink to={href}>{label}</RouterLink>
      </Link>
    </Text>
  )
}

type LineProps = {
  icon?: ReactNode
  tinted?: boolean
  id?: string
  ref?: Ref<HTMLElement>
  children: ReactNode
}

function Line({ icon, tinted = false, id, ref, children }: LineProps) {
  return (
    <Inline
      as="li"
      ref={ref}
      id={id}
      gap="none"
      align="center"
      wrap={false}
      className={cn(
        '-mx-2 min-h-11 scroll-mt-24 gap-3.5 rounded-lg px-2 transition-colors duration-700',
        'md:min-h-10',
        tinted && 'bg-accent-soft',
      )}
    >
      {icon !== undefined && (
        <Flex as="span" aria-hidden className={cn(marker, 'text-muted [&_svg]:size-4')}>
          {icon}
        </Flex>
      )}
      {children}
    </Inline>
  )
}
