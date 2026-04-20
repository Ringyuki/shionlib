'use client'

import { useTranslations } from 'next-intl'
import { ChangeDiff, type ChangeDiffLabels } from '@/components/common/diff/ChangeDiff'

interface EditChangesProps {
  changes: unknown
}

export const EditChanges = ({ changes }: EditChangesProps) => {
  const t = useTranslations('Components.User.Home.Edits.EditChanges')

  const labels: ChangeDiffLabels = {
    empty: t('empty'),
    path: t('path'),
    root: t('root'),
    before: t('before'),
    after: t('after'),
    added: t('added'),
    removed: t('removed'),
    updated: t('updated'),
    noDifferences: t('noDifferences'),
  }

  return <ChangeDiff changes={changes} labels={labels} />
}
