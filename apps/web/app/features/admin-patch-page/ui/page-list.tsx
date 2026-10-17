import { Inline, Link, Stack, Text } from '@hina-ui/react'
import { ExternalLink, X } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { IconButton } from '~/shared/ui/button'
import { addressOf, nameOf, sourceNames, type PatchPage } from '../admin-patch-page'

type PageListProps = {
  pages: PatchPage[]
  empty: string
  onRemove?: (page: PatchPage) => void
}

export function PageList({ pages, empty, onRemove }: PageListProps) {
  const t = useTranslations('adminPatchPage')
  if (pages.length === 0) {
    return (
      <Text
        tone="muted"
        size="sm"
        className="border-line rounded-lg border px-3.5 py-5 text-center"
      >
        {empty}
      </Text>
    )
  }
  return (
    <Stack
      as="ul"
      gap="none"
      aria-label={t('pages')}
      className="border-line divide-line m-0 list-none divide-y rounded-lg border p-0"
    >
      {pages.map(page => (
        <PageRow key={page.id} page={page} onRemove={onRemove} />
      ))}
    </Stack>
  )
}

function PageRow({ page, onRemove }: { page: PatchPage; onRemove?: (page: PatchPage) => void }) {
  const t = useTranslations('adminPatchPage')
  const name = nameOf(page)
  return (
    <Inline as="li" gap="md" align="center" wrap={false} className="py-3 ps-3.5 pe-2">
      <Stack gap="none" className="min-w-0 flex-1">
        <Text as="span" weight="medium" truncate>
          {name}
        </Text>
        <Inline gap="xs" align="center" className="min-w-0">
          <Link
            href={page.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm"
          >
            {addressOf(page)}
            <ExternalLink aria-hidden className="size-3" />
          </Link>
          {page.via !== null && (
            <Text as="span" size="sm" tone="muted">
              {`· ${t('via', { source: sourceNames[page.via.source], id: page.via.id })}`}
            </Text>
          )}
        </Inline>
      </Stack>
      <Text as="span" size="sm" tone="muted" className="shrink-0 tabular-nums">
        {t('resources', { count: page.resources })}
      </Text>
      {onRemove !== undefined && (
        <IconButton
          variant="ghost"
          tone="neutral"
          size="sm"
          label={t('remove', { name })}
          tooltip={false}
          onClick={() => onRemove(page)}
        >
          <X />
        </IconButton>
      )}
    </Inline>
  )
}
