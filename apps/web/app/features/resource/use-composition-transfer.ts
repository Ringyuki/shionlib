import { totals, uploadsOf, useUploadManager, useUploads, type InputRole } from '~/features/upload'
import type { Transfer } from './resource-composition'

export function useCompositionTransfer(compositionId: number | undefined, role: InputRole) {
  const manager = useUploadManager()
  const state = useUploads()
  const submission = state.submissions.find(
    candidate =>
      candidate.phase.name !== 'submitted' &&
      candidate.target.kind === 'compose' &&
      candidate.target.compositionId === compositionId &&
      candidate.target.role === role,
  )
  const uploads = submission === undefined ? [] : uploadsOf(state, submission.id)
  const transfer: Transfer | undefined =
    submission === undefined
      ? undefined
      : {
          name: uploads[0]?.name ?? uploads[0]?.file.name ?? submission.label,
          size: totals(uploads).size,
          percent: Math.round(totals(uploads).ratio * 100),
          failed:
            submission.phase.name === 'failed' ||
            uploads.some(upload => upload.phase.name === 'failed'),
        }
  return {
    transfer,
    send(file: File) {
      if (compositionId === undefined || manager === undefined) {
        return
      }
      if (submission !== undefined) {
        manager.dismiss(submission.id)
      }
      manager.add({ kind: 'compose', compositionId, role }, file.name, [{ file }])
    },
    stop() {
      if (submission !== undefined) {
        manager?.dismiss(submission.id)
      }
    },
  }
}

export type CompositionTransfer = ReturnType<typeof useCompositionTransfer>
