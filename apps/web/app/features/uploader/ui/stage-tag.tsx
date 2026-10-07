import { Tag } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { Stage } from '../uploader'

const tones = { uploading: 'accent', processing: 'neutral', published: 'success' } as const

export function StageTag({ stage }: { stage: Stage }) {
  const t = useTranslations('uploader.list')
  return (
    <Tag size="sm" tone={tones[stage]} className="shrink-0">
      {t(`stageName.${stage}`)}
    </Tag>
  )
}
