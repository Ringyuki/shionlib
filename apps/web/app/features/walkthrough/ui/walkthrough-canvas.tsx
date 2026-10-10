import { Form, ScrollArea, Stack, toast, type TextareaHandle } from '@hina-ui/react'
import { useRef } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { gameTitle } from '~/features/game'
import { useDocumentPicture } from '~/features/media'
import {
  EditorBlockMenu,
  EditorBubbleMenu,
  EditorOverlays,
  EditorTableMenu,
  EditorToolbar,
  useEditorUploading,
  useRichEditor,
} from '~/shared/editor'
import { useFormErrors } from '~/shared/form/use-form-errors'
import { useFormKit } from '~/shared/form/use-form-kit'
import { isBlank, textLength } from '~/shared/richtext/rich-text'
import { useKeyboardInset } from '~/shared/ui/use-keyboard-inset'
import { useWalkthroughWriting } from '../use-walkthrough-writing'
import { canvasColumn, walkthroughPath, walkthroughsPath, type Draft } from '../walkthrough'
import { firstInvalid, walkthroughForm } from '../walkthrough.schema'
import { WalkthroughCanvasBar } from './walkthrough-canvas-bar'
import { WalkthroughLeaveDialog } from './walkthrough-leave-dialog'
import { WalkthroughSheet } from './walkthrough-sheet'

const barHeight = 56

const toolbarHeight = 45

const tools =
  'border-line bg-canvas z-10 max-md:sticky max-md:order-last max-md:border-t md:sticky md:top-14 md:border-b'

type WalkthroughCanvasProps = { draft: Draft; onCreated: (created: number) => void }

export function WalkthroughCanvas({ draft, onCreated }: WalkthroughCanvasProps) {
  const t = useTranslations('walkthrough')
  const issue = useTranslations('walkthrough.issue')
  const locale = useLocale()
  const kit = useFormKit()
  const writing = useWalkthroughWriting(draft, onCreated)
  const { values, setValues, guard } = writing
  const form = useFormErrors(writing.failure)
  const title = useRef<TextareaHandle>(null)
  const publishing = useRef(false)
  const inset = useKeyboardInset()
  const handle = useRichEditor({
    profile: 'article',
    value: values.content,
    onValueChange: content => setValues(current => ({ ...current, content })),
    placeholder: t('contentHint'),
    upload: useDocumentPicture(),
  })
  const uploading = useEditorUploading(handle)
  const rules = walkthroughForm(kit, issue)
  const published = writing.state === 'published'
  const list = walkthroughsPath(locale, draft.game.id)
  const submit = async (publish: boolean) => {
    publishing.current = publish
    const invalid = firstInvalid(rules, values)
    await form.current?.submit()
    if (invalid === 'title') {
      title.current?.focus()
    } else if (invalid === 'content') {
      handle.editor?.view.focus()
    }
  }
  return (
    <Form
      ref={form}
      values={values}
      rules={rules}
      className="flex-1 gap-0"
      onSubmit={async () => {
        const saved = await writing.save(publishing.current)
        if (saved !== undefined && publishing.current) {
          const done = published ? 'saved' : 'published'
          toast.success(t(saved.state === 'published' ? done : 'sentForReview'))
        }
      }}
    >
      <WalkthroughCanvasBar
        back={writing.id === undefined ? list : walkthroughPath(locale, draft.game.id, writing.id)}
        game={gameTitle(draft.game, locale)}
        characters={textLength(values.content)}
        status={writing.unsaved ? t('unsaved') : writing.kept ? t('draftSaved') : undefined}
        draft={writing.state === 'draft'}
        saving={writing.saving}
        busy={uploading}
        onSave={publish => void submit(publish)}
      />
      <Stack gap="none" className={tools} style={{ bottom: inset }}>
        <ScrollArea direction="horizontal" scrollbar={false} className={canvasColumn}>
          <EditorToolbar handle={handle} history className="-ms-1.5 w-max py-1.5" />
        </ScrollArea>
      </Stack>
      <WalkthroughSheet
        handle={handle}
        heading={values.title}
        headingRef={title}
        blank={isBlank(values.content)}
        fresh={draft.walkthroughId === undefined}
        clearance={{ top: barHeight + toolbarHeight, bottom: toolbarHeight + inset }}
        onHeadingChange={next => setValues(current => ({ ...current, title: next }))}
      />
      <EditorBubbleMenu handle={handle} />
      <EditorBlockMenu handle={handle} />
      <EditorTableMenu handle={handle} />
      <EditorOverlays handle={handle} />
      <WalkthroughLeaveDialog guard={guard} />
    </Form>
  )
}
