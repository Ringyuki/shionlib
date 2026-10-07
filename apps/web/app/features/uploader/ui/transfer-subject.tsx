import { Inline, Tag, Text } from '@hina-ui/react'
import { FilePlus, FileUp, Gamepad2 } from 'lucide-react'
import { useMessages, useTranslations } from 'use-intl'
import { PlatformTag } from '~/features/game'
import type { Submission } from '~/features/upload'
import { labelOf } from '~/shared/i18n/labels'
import { Fact } from './fact'

export function TransferSubject({ submission }: { submission: Submission }) {
  const t = useTranslations('uploader.transfers')
  const labels = useMessages().game
  const { target, label } = submission
  switch (target.kind) {
    case 'orphan':
      return (
        <Text size="sm" tone="muted">
          {t('orphanHint')}
        </Text>
      )
    case 'append':
      return <Fact icon={FilePlus}>{t('appendsTo', { name: label })}</Fact>
    case 'replace':
      return <Fact icon={FileUp}>{t('replaces', { name: label })}</Fact>
    case 'create':
      return (
        <>
          <Fact icon={Gamepad2}>{label}</Fact>
          <Inline gap="xs" align="center" className="min-h-5.5">
            {target.resource.platform.map(platform => (
              <PlatformTag key={platform} platform={platform} />
            ))}
            {target.resource.language.map(language => (
              <Tag key={language} size="sm" variant="outline">
                {labelOf(labels.language, language)}
              </Tag>
            ))}
          </Inline>
        </>
      )
  }
}
