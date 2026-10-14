import { Card, Inline } from '@hina-ui/react'
import { useEditorLinking, type EditorHandle } from '../use-rich-editor'
import { fieldFrame } from './editor-frame'
import { EditorOverlays } from './editor-overlays'
import { EditorSurface } from './editor-surface'
import { EditorToolbar } from './editor-toolbar'

type EditorFieldProps = { handle: EditorHandle; label: string; refused: boolean }

export function EditorField({ handle, label, refused }: EditorFieldProps) {
  const linking = useEditorLinking(handle)
  return (
    <>
      <Card padded={false} data-linking={linking ? '' : undefined} className={fieldFrame(refused)}>
        <EditorSurface
          handle={handle}
          label={label}
          contentClassName="min-h-[calc(3lh+0.5rem)] ps-3 pe-2.5 pt-2"
        />
        <Inline className="ps-1.5 pe-2.5 pb-2">
          <EditorToolbar handle={handle} />
        </Inline>
      </Card>
      <EditorOverlays handle={handle} />
    </>
  )
}
