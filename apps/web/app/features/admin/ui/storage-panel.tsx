import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Panel,
  Progress,
  Stack,
  Text,
} from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import { spoolShare, spoolUsed, type Storage } from '../admin-stats'

type StoragePanelProps = {
  storage: Storage
}

export function StoragePanel({ storage }: StoragePanelProps) {
  const t = useTranslations('admin.overview.storage')
  const bytes = useBytes('short')
  const usage = t('usage', {
    used: bytes(spoolUsed(storage)),
    total: bytes(storage.spool_capacity),
  })
  return (
    <Panel title={t('title')}>
      <Stack gap="lg">
        <Stack gap="sm">
          <Progress
            value={spoolShare(storage) * 100}
            size="sm"
            label={t('spool')}
            showValue
            format={() => usage}
          />
          <Text as="span" size="sm" tone="muted">
            {t('reserve', { size: bytes(storage.spool_reserve) })}
          </Text>
        </Stack>
        <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
          <DescriptionTerm>{t('uploading')}</DescriptionTerm>
          <DescriptionDetails>
            {t('filesOf', { count: storage.uploading.files, size: bytes(storage.uploading.bytes) })}
          </DescriptionDetails>
          <DescriptionTerm>{t('awaitingCheck')}</DescriptionTerm>
          <DescriptionDetails>{t('files', { count: storage.awaiting_check })}</DescriptionDetails>
          <DescriptionTerm>{t('awaitingStore')}</DescriptionTerm>
          <DescriptionDetails>{t('files', { count: storage.awaiting_store })}</DescriptionDetails>
          <DescriptionTerm>{t('stored')}</DescriptionTerm>
          <DescriptionDetails>
            {t('sizeOf', { count: storage.stored.files, size: bytes(storage.stored.bytes) })}
          </DescriptionDetails>
        </DescriptionList>
      </Stack>
    </Panel>
  )
}
