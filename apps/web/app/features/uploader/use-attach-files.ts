import { toast } from '@hina-ui/react'
import { useFormatter, useTranslations } from 'use-intl'
import { chosenFiles, useUploadManager } from '~/features/upload'

export function useAttachFiles() {
  const t = useTranslations('uploader.transfers')
  const format = useFormatter()
  const manager = useUploadManager()
  return (value: File | File[] | null) => {
    const unmatched = manager?.attach(chosenFiles(value)) ?? []
    if (unmatched.length > 0) {
      toast.warning(t('unmatched', { names: format.list(unmatched.map(file => file.name)) }))
    }
  }
}
