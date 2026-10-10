import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from 'react'
import type { RichDocument } from '~/shared/richtext/rich-text'
import type { EditorPlugin, RichEditor } from './plugin'
import { pluginsOf, type Profile } from './profiles'
import { createSession, useStore, type EditorSession } from './session'

export type EditorContent = ComponentType<{ editor: RichEditor | null }>

export type EditorHandle = {
  editor: RichEditor | null
  Content: EditorContent | null
  plugins: readonly EditorPlugin[]
  session: EditorSession
  placeholder: string
}

type RichEditorOptions = {
  profile: Profile
  value: RichDocument
  onValueChange: (value: RichDocument) => void
  placeholder?: string
}

type Engine = { editor: RichEditor; Content: EditorContent }

export function useRichEditor({
  profile,
  value,
  onValueChange,
  placeholder = '',
}: RichEditorOptions): EditorHandle {
  const plugins = useMemo(() => pluginsOf(profile), [profile])
  const [engine, setEngine] = useState<Engine | null>(null)
  const [failure, setFailure] = useState<unknown>(undefined)
  const shown = useRef(value)
  const latest = useRef({ value, onValueChange })
  const [session] = useState(createSession)
  useEffect(() => {
    latest.current = { value, onValueChange }
  })
  useEffect(() => {
    let created: RichEditor | undefined
    let wanted = true
    import('./engine').then(({ createEditor, Content }) => {
      if (!wanted) {
        return
      }
      shown.current = latest.current.value
      created = createEditor({
        plugins,
        session,
        placeholder,
        content: latest.current.value,
        onChange: next => {
          shown.current = next
          latest.current.onValueChange(next)
        },
      })
      setEngine({ editor: created, Content })
    }, setFailure)
    return () => {
      wanted = false
      created?.destroy()
      setEngine(null)
    }
  }, [plugins, session, placeholder])
  const editor = engine?.editor ?? null
  useEffect(() => {
    if (editor !== null && value !== shown.current) {
      shown.current = value
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])
  if (failure !== undefined) {
    throw failure
  }
  return { editor, Content: engine?.Content ?? null, plugins, session, placeholder }
}

export function useEditorLinking(handle: EditorHandle): boolean {
  return useStore(handle.session.link) !== null
}

const events = ['transaction', 'focus', 'blur'] as const

export function useEditorValue<Value extends string | number | boolean>(
  editor: RichEditor | null,
  read: (editor: RichEditor) => Value,
  idle: Value,
): Value {
  const watch = useCallback(
    (notify: () => void) => {
      if (editor === null) {
        return () => undefined
      }
      for (const event of events) {
        editor.on(event, notify)
      }
      return () => {
        for (const event of events) {
          editor.off(event, notify)
        }
      }
    },
    [editor],
  )
  return useSyncExternalStore(
    watch,
    () => (editor === null || editor.isDestroyed ? idle : read(editor)),
    () => idle,
  )
}
