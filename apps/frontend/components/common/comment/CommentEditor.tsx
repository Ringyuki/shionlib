import { $getRoot, SerializedEditorState } from 'lexical'
import { initialValue } from './constants/initialValue'
import { Editor } from '@/components/editor/Editor'
import { Plugins } from './editor/plugins'
import { useState, useImperativeHandle, forwardRef, useEffect } from 'react'

interface CommentEditorProps {
  onSubmit: (serialized: SerializedEditorState) => void
  isSubmitting: boolean
  _initialValue?: SerializedEditorState
}

export const CommentEditor = forwardRef(
  ({ onSubmit, isSubmitting, _initialValue }: CommentEditorProps, ref) => {
    const [serialized, setSerialized] = useState<SerializedEditorState>(
      _initialValue || initialValue,
    )
    const [editorKey, setEditorKey] = useState(0)
    const [wordsCount, setWordsCount] = useState(0)
    const [clearSignal, setClearSignal] = useState<number | undefined>(undefined)
    useImperativeHandle(ref, () => ({
      clearEditor: () => {
        setClearSignal(s => (s ?? 0) + 1)
      },
    }))

    useEffect(() => {
      if (_initialValue) {
        setSerialized(_initialValue)
        setEditorKey(k => k + 1)
      }
    }, [_initialValue])
    return (
      <div className="flex flex-col w-full min-w-0">
        <Editor
          key={editorKey}
          CustomPlugins={Plugins}
          editorSerializedState={serialized}
          onSerializedChange={value => setSerialized(value)}
          autoFocus={false}
          onChange={state => {
            const count = state.read(() => $getRoot().getTextContentSize())
            setWordsCount(count)
          }}
          onSubmit={() => onSubmit(serialized)}
          isSubmitting={isSubmitting}
          isSubmitDisabled={wordsCount === 0}
          clearSignal={clearSignal}
        />
      </div>
    )
  },
)

CommentEditor.displayName = 'CommentEditor'
