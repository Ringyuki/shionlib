import { useImageResolver } from '@hina-ui/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from 'react'
import { useTranslations } from 'use-intl'
import type { RichDocument } from '~/shared/richtext/rich-text'
import type { EditorPlugin, RichEditor } from './plugin'
import { commandsOf, movesBlocks, pluginsOf, type Profile } from './profiles'
import {
  createSession,
  useStore,
  type EditorSession,
  type EngineLabels,
  type PictureUpload,
} from './session'

export type EditorContent = ComponentType<{ editor: RichEditor | null; className?: string }>

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
  upload?: PictureUpload
}

type Engine = { editor: RichEditor; Content: EditorContent }

export function useRichEditor({
  profile,
  value,
  onValueChange,
  placeholder = '',
  upload,
}: RichEditorOptions): EditorHandle {
  const t = useTranslations('editor')
  const resolveImage = useImageResolver()
  const plugins = useMemo(() => pluginsOf(profile), [profile])
  const [engine, setEngine] = useState<Engine | null>(null)
  const [failure, setFailure] = useState<unknown>(undefined)
  const shown = useRef(value)
  const labels: EngineLabels = {
    selectRow: t('table.selectRow'),
    selectColumn: t('table.selectColumn'),
    appendRow: t('table.appendRow'),
    appendColumn: t('table.appendColumn'),
    dragBlock: t('block.drag'),
    addBlock: t('block.add'),
    uploading: percent => t('uploading', { percent }),
    uploadFailed: t('uploadFailed'),
    retryUpload: t('retry'),
    dropUpload: t('remove'),
  }
  const latest = useRef({ value, onValueChange, labels })
  const [session] = useState(createSession)
  useEffect(() => {
    latest.current = { value, onValueChange, labels }
    session.upload.set(upload)
    session.resolvePicture.set(key => resolveImage(key, 'image'))
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
        commands: commandsOf(profile),
        blocks: movesBlocks(profile),
        session,
        labels: latest.current.labels,
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
  }, [profile, plugins, session, placeholder])
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

export function useEditorUploading(handle: EditorHandle): boolean {
  return useStore(handle.session.uploading) > 0
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
