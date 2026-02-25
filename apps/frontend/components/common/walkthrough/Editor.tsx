'use client'

import { Editor } from '@/components/editor/Editor'
import { Plugins } from './editor/plugins'
import { useScrollToTopControl } from '@/components/common/site/ScrollToTop'
import { useEffect } from 'react'
import { Walkthrough } from '@/interfaces/walkthrough/walkthrough.interface'
import { SerializedEditorState } from 'lexical'
import { useTranslations } from 'next-intl'

interface WalkthroughEditorProps {
  walkthrough?: Walkthrough
  onSerializedChange?: (state: SerializedEditorState) => void
  onDraft?: () => void
  isDraftSubmitting?: boolean
  onPublish?: () => void
  isPublishSubmitting?: boolean
  isSubmitDisabled?: boolean
}

export const WalkthroughEditor = ({
  walkthrough,
  onSerializedChange,
  onDraft,
  isDraftSubmitting,
  onPublish,
  isPublishSubmitting,
  isSubmitDisabled,
}: WalkthroughEditorProps) => {
  const t = useTranslations('Components.Game.Walkthrough')
  const { hide } = useScrollToTopControl()
  useEffect(() => {
    hide()
  }, [hide])

  return (
    <div className="w-full min-w-0 bg-background border rounded-md">
      <Editor
        CustomPlugins={Plugins}
        editorSerializedState={walkthrough?.content}
        onSerializedChange={onSerializedChange}
        onSubmit={onPublish}
        isSubmitting={isPublishSubmitting}
        isSubmitDisabled={isSubmitDisabled}
        CustomPluginProps={{
          submitLabel: t('publish'),
          onDraft,
          isDraftSubmitting,
          draftLabel: t('save_draft'),
        }}
      />
    </div>
  )
}
