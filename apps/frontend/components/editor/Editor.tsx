'use client'

import { InitialConfigType, LexicalComposer } from '@lexical/react/LexicalComposer'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { EditorState, SerializedEditorState } from 'lexical'

import { editorTheme } from '@/components/editor/libs/themes/editor-theme'
import { TooltipProvider } from '@/components/shionui/Tooltip'

import { nodes } from './nodes'
import { Plugins } from './plugins'
import { Plugin, PluginProps } from './interfaces/plugin'

const editorConfig: InitialConfigType = {
  namespace: 'Editor',
  theme: editorTheme,
  nodes,
  onError: (error: Error) => {
    console.error(error)
  },
}

interface EditorProps {
  CustomPlugins?: Plugin
  CustomPluginProps?: PluginProps
  editorState?: EditorState
  editorSerializedState?: SerializedEditorState
  onChange?: (editorState: EditorState) => void
  onSerializedChange?: (editorSerializedState: SerializedEditorState) => void
  autoFocus?: boolean
  onSubmit?: () => void
  isSubmitting?: boolean
  isSubmitDisabled?: boolean
  clearSignal?: number
}

export const Editor = ({
  CustomPlugins,
  CustomPluginProps,
  editorState,
  editorSerializedState,
  onChange,
  onSerializedChange,
  autoFocus,
  onSubmit,
  isSubmitting,
  isSubmitDisabled,
  clearSignal,
}: EditorProps) => {
  return (
    <div className="w-full min-w-0 bg-background overflow-hidden rounded-lg border shadow">
      <LexicalComposer
        initialConfig={{
          ...editorConfig,
          ...(editorState ? { editorState } : {}),
          ...(editorSerializedState ? { editorState: JSON.stringify(editorSerializedState) } : {}),
        }}
      >
        <TooltipProvider>
          {CustomPlugins ? (
            <CustomPlugins
              autoFocus={autoFocus}
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
              isSubmitDisabled={isSubmitDisabled}
              clearSignal={clearSignal}
              {...CustomPluginProps}
            />
          ) : (
            <Plugins
              autoFocus={autoFocus}
              onSubmit={onSubmit}
              isSubmitting={isSubmitting}
              isSubmitDisabled={isSubmitDisabled}
              clearSignal={clearSignal}
            />
          )}

          <OnChangePlugin
            ignoreSelectionChange={true}
            onChange={editorState => {
              onChange?.(editorState)
              onSerializedChange?.(editorState.toJSON())
            }}
          />
        </TooltipProvider>
      </LexicalComposer>
    </div>
  )
}
