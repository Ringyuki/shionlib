import { useTranslations } from 'use-intl'
import type { Admission } from '~/features/upload'
import { useBytes } from '~/shared/i18n/use-bytes'

export function useAdmissionMessage() {
  const t = useTranslations('resource.admission')
  const bytes = useBytes()
  return (admission: Admission): string => {
    switch (admission.kind) {
      case 'full':
        return t('full')
      case 'empty':
        return t('empty', { file: admission.file })
      case 'tooLarge':
        return t('tooLarge', {
          file: admission.file,
          size: bytes(admission.size),
          limit: bytes(admission.limit),
        })
      case 'overQuota':
        return t('overQuota', { total: bytes(admission.total), left: bytes(admission.left) })
    }
  }
}
