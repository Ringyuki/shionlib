import {
  CopyButton,
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Inline,
  Text,
} from '@hina-ui/react'
import { Fragment } from 'react'
import { useFormatter, useTranslations } from 'use-intl'
import { useBytes } from '~/shared/i18n/use-bytes'
import type { ResourceFile } from '../resource'
import { digestsOf } from '../resource-page'

export function FileFacts({ file }: { file: ResourceFile }) {
  const t = useTranslations('resource')
  const format = useFormatter()
  const bytes = useBytes()
  return (
    <DescriptionList orientation="horizontal" className="[--hn-dl-term-width:8.25rem]">
      <DescriptionTerm>{t('page.details.name')}</DescriptionTerm>
      <DescriptionDetails className="break-all">{file.file_name}</DescriptionDetails>
      <DescriptionTerm>{t('page.details.size')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">
        {t('page.details.bytes', { size: bytes(file.file_size), bytes: file.file_size })}
      </DescriptionDetails>
      {digestsOf(file).map(digest => (
        <Fragment key={digest.name}>
          <DescriptionTerm>{digest.name}</DescriptionTerm>
          <DescriptionDetails>
            <Inline gap="xs" align="start" wrap={false}>
              <Text as="span" size="sm" className="font-mono break-all">
                {digest.value}
              </Text>
              <CopyButton text={digest.value} label={t('copyHash')} size="sm" />
            </Inline>
          </DescriptionDetails>
        </Fragment>
      ))}
      <DescriptionTerm>{t('page.details.uploaded')}</DescriptionTerm>
      <DescriptionDetails>
        {format.dateTime(new Date(file.uploaded), { dateStyle: 'long', timeStyle: 'short' })}
      </DescriptionDetails>
    </DescriptionList>
  )
}
