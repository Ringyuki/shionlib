import { Card, Form, FormField } from '@hina-ui/react'
import { useEffect, useState } from 'react'
import { useTranslations } from 'use-intl'
import {
  EditorOverlays,
  EditorSurface,
  fieldFrame,
  useEditorLinking,
  useRichEditor,
} from '~/shared/editor'
import { useFormErrors } from '~/shared/form/use-form-errors'
import {
  blankDocument,
  isBlank,
  sameDocument,
  type RichDocument,
} from '~/shared/richtext/rich-text'
import { namesFields, useRefusalText, type Refused } from '~/shared/route/refusal'
import { commentForm, type CommentValues } from '../comment.schema'
import { textArea } from './composer-field'
import { ComposerTools } from './composer-tools'

type CommentComposerProps = {
  label: string
  hint: string
  initial?: RichDocument
  submitLabel: string
  pending: boolean
  refused: Refused | undefined
  collapsible?: boolean
  autoFocus?: boolean
  onSubmit: (content: RichDocument) => Promise<boolean>
  onCancel?: () => void
}

export function CommentComposer({
  label,
  hint,
  initial = blankDocument,
  submitLabel,
  pending,
  refused,
  collapsible = false,
  autoFocus = false,
  onSubmit,
  onCancel,
}: CommentComposerProps) {
  const issue = useTranslations('comment.issue')
  const [values, setValues] = useState<CommentValues>({ content: initial })
  const [open, setOpen] = useState(!collapsible)
  const [answered, setAnswered] = useState(refused)
  const form = useFormErrors(refused?.failure)
  const phrase = useRefusalText()
  const said =
    refused === undefined || refused === answered || namesFields(refused)
      ? undefined
      : phrase(refused)
  const handle = useRichEditor({
    profile: 'comment',
    value: values.content,
    onValueChange: content => {
      setValues({ content })
      setAnswered(refused)
    },
    placeholder: hint,
  })
  const { editor } = handle
  const linking = useEditorLinking(handle)
  useEffect(() => {
    if (autoFocus) {
      editor?.commands.focus('end')
    }
  }, [autoFocus, editor])
  const idle = isBlank(values.content) || sameDocument(values.content, initial)
  const clear = () => {
    form.current?.reset()
    setValues({ content: blankDocument })
    setAnswered(refused)
    setOpen(!collapsible)
    if (editor?.isDestroyed === false) {
      editor.commands.blur()
    }
  }
  return (
    <Form
      ref={form}
      values={values}
      rules={commentForm(issue)}
      className="min-w-0 flex-1"
      onSubmit={async () => {
        if (await onSubmit(values.content)) {
          clear()
        }
      }}
    >
      {({ errors }) => (
        <FormField name="content" error={said}>
          <Card
            padded={false}
            data-linking={linking ? '' : undefined}
            className={fieldFrame((errors.content ?? said) !== undefined)}
            onFocus={() => setOpen(true)}
            onKeyDownCapture={event => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                event.stopPropagation()
                if (!idle && !pending) {
                  void form.current?.submit()
                }
              }
            }}
          >
            <EditorSurface
              handle={handle}
              label={label}
              contentClassName={textArea(collapsible, open)}
            />
            <ComposerTools
              handle={handle}
              submitLabel={submitLabel}
              pending={pending}
              idle={idle}
              collapsible={collapsible}
              shown={open}
              onCancel={() => {
                clear()
                onCancel?.()
              }}
            />
          </Card>
          <EditorOverlays handle={handle} />
        </FormField>
      )}
    </Form>
  )
}
