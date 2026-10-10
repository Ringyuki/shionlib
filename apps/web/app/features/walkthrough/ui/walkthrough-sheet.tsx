import { FormField, Stack, Textarea, type TextareaHandle } from '@hina-ui/react'
import { useEffect, useRef, type Ref } from 'react'
import { useTranslations } from 'use-intl'
import { EditorBlockHandle, EditorSurface, type EditorHandle } from '~/shared/editor'
import { canvasColumn } from '../walkthrough'

type WalkthroughSheetProps = {
  handle: EditorHandle
  heading: string
  headingRef: Ref<TextareaHandle>
  blank: boolean
  fresh: boolean
  clearance: { top: number; bottom: number }
  onHeadingChange: (heading: string) => void
}

export function WalkthroughSheet({
  handle,
  heading,
  headingRef,
  blank,
  fresh,
  clearance,
  onHeadingChange,
}: WalkthroughSheetProps) {
  const t = useTranslations('walkthrough')
  const { editor } = handle
  const awaited = useRef(false)
  useEffect(() => {
    if (awaited.current && editor !== null) {
      awaited.current = false
      editor.view.focus()
    }
  }, [editor])
  return (
    <Stack
      gap="md"
      className={`${canvasColumn} flex-1 cursor-text pt-10 pb-24`}
      onClick={event => {
        if (event.target === event.currentTarget) {
          editor?.commands.focus('end')
        }
      }}
    >
      <FormField name="title">
        <Textarea
          ref={headingRef}
          variant="bare"
          autosize
          rows={1}
          autoFocus={fresh}
          aria-label={t('title')}
          placeholder={t('title')}
          value={heading}
          onValueChange={onHeadingChange}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              awaited.current = editor === null
              editor?.view.focus()
            }
          }}
          className="text-3xl font-semibold tracking-tight [--hn-textarea-px:0px]"
        />
      </FormField>
      <FormField name="content">
        <EditorSurface
          handle={handle}
          label={t('content')}
          clearance={clearance}
          contentClassName={blank ? undefined : 'min-h-[40vh]'}
        >
          <EditorBlockHandle handle={handle} />
        </EditorSurface>
      </FormField>
    </Stack>
  )
}
