import { Card, FormField, Inline, Stack } from '@hina-ui/react'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'use-intl'
import {
  EditorOverlays,
  EditorSurface,
  EditorToolbar,
  fieldFrame,
  useEditorLinking,
  useRichEditor,
} from '~/shared/editor'
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
  const linking = useEditorLinking(handle)
  const field = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (error !== undefined) {
      field.current?.scrollIntoView({ block: 'center' })
    }
  }, [error])
  return (
    <Stack ref={field} gap="none" className={measure}>
      <FormField label={<OptionalLabel>{t('note')}</OptionalLabel>} error={error}>
        <Card
          padded={false}
          data-linking={linking ? '' : undefined}
          className={fieldFrame(error !== undefined)}
        >
          <EditorSurface
            handle={handle}
            label={t('note')}
            contentClassName="min-h-[calc(3lh+0.5rem)] ps-3 pe-2.5 pt-2"
          />
          <Inline className="ps-1.5 pe-2.5 pb-2">
            <EditorToolbar handle={handle} />
          </Inline>
        </Card>
        <EditorOverlays handle={handle} />
      </FormField>
    </Stack>
  )
}
