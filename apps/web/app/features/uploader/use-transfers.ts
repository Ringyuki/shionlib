import { useEffect, useState } from 'react'
import { submitted, uploadsOf, useUploadManager, useUploads } from '~/features/upload'
import { heldSince, type Transfer } from './uploader'

const noneHeld: ReadonlyMap<string, object> = new Map()

export function useTransfers(loaded: object): Transfer[] {
  const manager = useUploadManager()
  const state = useUploads()
  const [held, setHeld] = useState(noneHeld)
  const holding = heldSince(
    held,
    submitted(state).map(submission => submission.id),
    loaded,
  )
  if (holding !== held) {
    setHeld(holding)
  }
  useEffect(() => {
    for (const submission of submitted(state)) {
      if (holding.get(submission.id) !== loaded) {
        manager?.dismiss(submission.id)
      }
    }
  }, [state, holding, loaded, manager])
  return state.submissions
    .filter(
      submission => submission.phase.name !== 'submitted' || holding.get(submission.id) === loaded,
    )
    .map(submission => ({ submission, uploads: uploadsOf(state, submission.id) }))
}
