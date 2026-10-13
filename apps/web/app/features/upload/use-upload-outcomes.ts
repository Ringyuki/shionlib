import { toast } from '@hina-ui/react'
import { useEffect, useRef } from 'react'
import { useRevalidator } from 'react-router'
import { useTranslations } from 'use-intl'
import type { UploadState } from './upload'

export function useUploadOutcomes(state: UploadState) {
  const t = useTranslations('upload')
  const { revalidate } = useRevalidator()
  const seen = useRef(new Map<string, string>())
  useEffect(() => {
    for (const submission of state.submissions) {
      const before = seen.current.get(submission.id)
      const now = submission.phase.name
      seen.current.set(submission.id, now)
      if (before === undefined || before === now) {
        continue
      }
      if (now === 'submitted') {
        toast.success(t('submittedToast', { label: submission.label }))
        void revalidate()
      }
      if (now === 'failed') {
        toast.danger(t('failedToast', { label: submission.label }))
      }
    }
  }, [state.submissions, t, revalidate])
}
