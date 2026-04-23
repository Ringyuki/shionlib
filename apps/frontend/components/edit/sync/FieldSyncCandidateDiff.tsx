import { useTranslations } from 'next-intl'
import { ChangeDiff, type ChangeDiffLabels } from '@/components/common/diff/ChangeDiff'
import type { FieldSyncCandidate } from '../types/field-sync'

interface FieldSyncCandidateDiffProps {
  candidate: FieldSyncCandidate
}

const toDiffChanges = (candidate: FieldSyncCandidate) => {
  if (candidate.action === 'add' && candidate.remote) {
    return { added: [candidate.remote] }
  }
  if (candidate.action === 'remove' && candidate.local) {
    return { removed: [candidate.local] }
  }
  return { before: candidate.local ?? {}, after: candidate.remote ?? {} }
}

export const FieldSyncCandidateDiff = ({ candidate }: FieldSyncCandidateDiffProps) => {
  const t = useTranslations('Components.Common.Edit.FieldSync')

  if (!candidate.local && !candidate.remote) {
    return null
  }

  const labels: ChangeDiffLabels = {
    empty: t('diff.empty'),
    path: t('diff.path'),
    root: t('diff.root'),
    before: t('local'),
    after: t('remote'),
    added: t('action.add'),
    removed: t('action.remove'),
    updated: t('action.update'),
    noDifferences: t('diff.noDifferences'),
  }

  return <ChangeDiff changes={toDiffChanges(candidate)} labels={labels} />
}
