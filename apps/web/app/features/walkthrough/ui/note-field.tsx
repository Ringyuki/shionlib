import { FormField, Stack } from '@hina-ui/react'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'use-intl'
import { EditorField, useRichEditor } from '~/shared/editor'
import type { RichDocument } from '~/shared/richtext/rich-text'
import { OptionalLabel } from './optional-label'

const measure = 'max-w-[calc(65ch+1.375rem)]'

type NoteFieldProps = {
  value: RichDocument
  error: string | undefined
  onValueChange: (value: RichDocument) => void
}

export function NoteField({ value, error, onValueChange }: NoteFieldProps) {
  const t = useTranslations('walkthrough')
  const handle = useRichEditor({ profile: 'comment', value, onValueChange })
  const field = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (error !== undefined) {
      field.current?.scrollIntoView({ block: 'center' })
    }
  }, [error])
  return (
    <Stack ref={field} gap="none" className={measure}>
      <FormField label={<OptionalLabel>{t('note')}</OptionalLabel>} error={error}>
        <EditorField handle={handle} label={t('note')} refused={error !== undefined} />
      </FormField>
    </Stack>
  )
}
