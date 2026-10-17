import { Empty, Flex, Inline, SegmentedControl, Spinner, Stack, Text } from '@hina-ui/react'
import { CloudOff } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { shownPages, withoutPage, withPage, type Draft, type PatchPages } from '../admin-patch-page'
import { AddressForm } from './address-form'
import { PageList } from './page-list'

const modes = ['ids', 'manual'] as const

type PatchPagesBodyProps = {
  pages: PatchPages | undefined
  draft: Draft | undefined
  failed: boolean
  retrying: boolean
  onRetry: () => void
  onChange: (draft: Draft) => void
}

export function PatchPagesBody({
  pages,
  draft,
  failed,
  retrying,
  onRetry,
  onChange,
}: PatchPagesBodyProps) {
  const t = useTranslations('adminPatchPage')
  if (failed && !retrying) {
    return (
      <Empty
        icon={<CloudOff />}
        title={t('unreadable')}
        size="sm"
        actions={
          <Button variant="outline" tone="neutral" size="sm" onClick={onRetry}>
            {t('retry')}
          </Button>
        }
      />
    )
  }
  if (pages === undefined || draft === undefined) {
    return (
      <Flex align="center" justify="center" className="h-40">
        <Spinner label={t('loading')} />
      </Flex>
    )
  }
  return (
    <Stack gap="md">
      <SegmentedControl
        size="sm"
        aria-label={t('mode.label')}
        className="self-start"
        value={draft.manual ? 'manual' : 'ids'}
        options={modes.map(mode => ({ value: mode, label: t(`mode.${mode}`) }))}
        onValueChange={value => onChange({ ...draft, manual: value === 'manual' })}
      />
      {draft.manual ? (
        <AddressForm draft={draft} onAdd={page => onChange(withPage(draft, page))} />
      ) : (
        <Inline gap="lg" aria-label={t('ids')} className="text-sm">
          <Identifier name="VNDB" value={pages.vndb_id} />
          <Identifier name="Bangumi" value={pages.bangumi_id} />
        </Inline>
      )}
      <PageList
        pages={shownPages(pages, draft)}
        empty={t(draft.manual ? 'hidden' : 'noMatch')}
        onRemove={draft.manual ? page => onChange(withoutPage(draft, page.id)) : undefined}
      />
    </Stack>
  )
}

function Identifier({ name, value }: { name: string; value: string | null }) {
  const t = useTranslations('adminPatchPage')
  return (
    <Inline gap="sm">
      <Text as="span" size="inherit" tone="muted">
        {name}
      </Text>
      <Text as="span" size="inherit">
        {value ?? t('none')}
      </Text>
    </Inline>
  )
}
