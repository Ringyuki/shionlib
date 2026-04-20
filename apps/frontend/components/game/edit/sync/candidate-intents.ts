import type { SyncCandidateAction, SyncCandidateConfidence } from './types'

export const actionIntent = (action: SyncCandidateAction) => {
  if (action === 'add') return 'success'
  if (action === 'update') return 'info'
  if (action === 'remove') return 'destructive'
  return 'warning'
}

export const confidenceIntent = (confidence: SyncCandidateConfidence) => {
  if (confidence === 'exact' || confidence === 'high') return 'success'
  if (confidence === 'medium') return 'warning'
  return 'destructive'
}
