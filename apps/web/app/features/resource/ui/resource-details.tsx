import {
  CopyButton,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Heading,
  Inline,
  Stack,
  Text,
} from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { Resource, ResourceFile } from '../resource'
import { hashName } from '../resource-page'

export function ResourceDetails({ resource }: { resource: Resource }) {
  const t = useTranslations('resource.page.details')
  return (
    <Stack as="section" gap="md">
      <Heading level={2} size="md">
        {t('file')}
      </Heading>
      <Stack gap="xl">
        {(resource.files ?? []).map(file => (
          <FileFacts key={file.id} file={file} />
        ))}
      </Stack>
    </Stack>
  )
}

function FileFacts({ file }: { file: ResourceFile }) {
  const t = useTranslations('resource')
  const format = useFormatter()
  const bytes = useBytes()
  return (
    <DescriptionList orientation="horizontal">
      <DescriptionTerm>{t('page.details.name')}</DescriptionTerm>
      <DescriptionDetails className="break-all">{file.file_name}</DescriptionDetails>
      <DescriptionTerm>{t('page.details.size')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">
        {t('page.details.bytes', { size: bytes(file.file_size), bytes: file.file_size })}
      </DescriptionDetails>
      <DescriptionTerm>{hashName(file.hash_algorithm)}</DescriptionTerm>
      <DescriptionDetails>
        <Inline gap="xs" align="start" wrap={false}>
          <Text as="span" size="sm" className="font-mono break-all">
            {file.file_hash}
          </Text>
          <CopyButton text={file.file_hash} label={t('copyHash')} size="sm" />
        </Inline>
      </DescriptionDetails>
      <DescriptionTerm>{t('page.details.uploaded')}</DescriptionTerm>
      <DescriptionDetails>
        {format.dateTime(new Date(file.uploaded), { dateStyle: 'long', timeStyle: 'short' })}
      </DescriptionDetails>
    </DescriptionList>
  )
}
