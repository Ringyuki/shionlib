import {
  DescriptionDetails,
  DescriptionList,
  DescriptionTerm,
  Link,
  Tag,
  Text,
} from '@hina-ui/react'
import { ExternalLink } from 'lucide-react'
import { useLocale, useTranslations } from 'use-intl'
import { titleOf } from '~/features/admin'
import { gamePath } from '~/features/game'
import { resourcePath } from '~/features/resource'
import type { UploadDetail } from '../admin-upload'

type Composition = NonNullable<UploadDetail['composition']>

const tones = {
  draft: 'neutral',
  queued: 'neutral',
  running: 'info',
  done: 'success',
  failed: 'danger',
} as const

export function UploadComposition({
  detail,
  composition,
}: {
  detail: UploadDetail
  composition: Composition
}) {
  const t = useTranslations('adminUpload')
  const locale = useLocale()
  const { state } = composition
  return (
    <DescriptionList orientation="horizontal" className="text-sm [--hn-dl-term-width:5rem]">
      {detail.game !== null && (
        <>
          <DescriptionTerm>{t('composition.game')}</DescriptionTerm>
          <DescriptionDetails>
            <Link href={gamePath(locale, detail.game.id)} target="_blank" rel="noreferrer">
              {titleOf(detail.game)}
            </Link>
          </DescriptionDetails>
        </>
      )}
      <DescriptionTerm>{t('composition.id')}</DescriptionTerm>
      <DescriptionDetails className="tabular-nums">{`#${composition.id}`}</DescriptionDetails>
      <DescriptionTerm>{t('composition.state')}</DescriptionTerm>
      <DescriptionDetails>
        {state === null ? (
          <Text as="span" size="inherit" tone="muted">
            {t('composition.deleted')}
          </Text>
        ) : (
          <Tag tone={tones[state]}>{t(`composition.stateName.${state}`)}</Tag>
        )}
      </DescriptionDetails>
      {composition.resource_id !== null && (
        <>
          <DescriptionTerm>{t('composition.resource')}</DescriptionTerm>
          <DescriptionDetails>
            <Link
              href={resourcePath(locale, composition.resource_id)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1"
            >
              {`#${composition.resource_id}`}
              <ExternalLink aria-label={t('target.openResource')} className="size-3.5" />
            </Link>
          </DescriptionDetails>
        </>
      )}
    </DescriptionList>
  )
}
