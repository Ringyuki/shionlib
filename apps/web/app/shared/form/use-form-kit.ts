import { useMemo } from 'react'
import { useTranslations } from 'use-intl'
import { createFormKit, type FieldIssue, type FormKit } from './form-kit'

export function useFormKit(): FormKit {
  const t = useTranslations('form')
  return useMemo(
    () =>
      createFormKit((issue: FieldIssue) => {
        switch (issue.kind) {
          case 'required':
            return t('required')
          case 'minLength':
            return t('minLength', { min: issue.min })
          case 'maxLength':
            return t('maxLength', { max: issue.max })
          case 'format':
            return issue.format === 'email' ? t('email') : t('format')
          case 'pattern':
            return t('format')
          case 'enum':
            return t('enum')
        }
      }),
    [t],
  )
}
