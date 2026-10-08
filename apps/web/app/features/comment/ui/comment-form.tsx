import { Form, FormField, Inline } from '@hina-ui/react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import type { ApiFailure } from '~/shared/api/types'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { BBCodeEditor } from '~/shared/ui/bbcode-editor'
import { Button } from '~/shared/ui/button'
import { commentForm, type CommentValues } from '../comment.schema'

type CommentFormProps = {
  label: string
  initial?: string
  submitLabel: string
  pending: boolean
  failure: ApiFailure | undefined
  onSubmit: (content: string) => Promise<boolean>
  onCancel?: () => void
}

export function CommentForm({
  label,
  initial = '',
  submitLabel,
  pending,
  failure,
  onSubmit,
  onCancel,
}: CommentFormProps) {
  const t = useTranslations('comment')
  const issue = useTranslations('comment.issue')
  const [values, setValues] = useState<CommentValues>({ content: initial })
  const form = useFormErrors(failure)
  return (
    <Form
      ref={form}
      values={values}
      rules={commentForm(issue)}
      onSubmit={async () => {
        if (await onSubmit(values.content)) {
          form.current?.reset()
          setValues({ content: '' })
        }
      }}
    >
      <FormField name="content">
        <BBCodeEditor
          aria-label={label}
          placeholder={label}
          value={values.content}
          onValueChange={content => setValues({ content })}
        />
      </FormField>
      <Inline justify="end" gap="sm">
        {onCancel !== undefined && (
          <Button variant="ghost" tone="neutral" disabled={pending} onClick={onCancel}>
            {t('cancel')}
          </Button>
        )}
        <Button
          type="submit"
          loading={pending}
          disabled={values.content.trim() === '' || values.content.trim() === initial.trim()}
        >
          {submitLabel}
        </Button>
      </Inline>
    </Form>
  )
}
