import type { FieldSyncCandidate } from '../types/field-sync'

export const filterCandidates = (candidates: FieldSyncCandidate[], query: string) => {
  if (!query.trim()) return candidates
  const needle = query.trim().toLowerCase()
  return candidates.filter(candidate =>
    [candidate.title, candidate.subtitle, candidate.source, candidate.action]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(needle)),
  )
}
