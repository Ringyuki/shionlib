import { FormField } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import { EditorField, useRichEditor } from '~/shared/editor'
import { lengthOf } from '~/shared/form/form-kit'
import type { RichDocument } from '~/shared/richtext/rich-text'

type NoteFieldProps = {
  value: RichDocument
  refused: boolean
  onValueChange: (value: RichDocument) => void
}

export function NoteField({ value, refused, onValueChange }: NoteFieldProps) {
  const t = useTranslations('resource')
  const handle = useRichEditor({ profile: 'comment', value, onValueChange })
  return (
    <FormField
      name="note"
      label={t('note')}
      description={t('noteHint', lengthOf('EditDownloadSourceBodyInput', 'note'))}
    >
      <EditorField handle={handle} label={t('note')} refused={refused} />
    </FormField>
  )
}
