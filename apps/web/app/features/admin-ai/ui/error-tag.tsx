import { Tag } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { errorKindOf, errorTone } from '../admin-ai'

export function ErrorTag({ kind }: { kind: string }) {
  const t = useTranslations('adminAi.errorKind')
  const known = errorKindOf(kind)
  return <Tag tone={errorTone(known)}>{t(known)}</Tag>
}
