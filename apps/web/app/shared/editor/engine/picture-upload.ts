import type { Editor } from '@tiptap/core'
import type { EditorState } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import { initialPercent } from '../picture-size'
import type { EditorSession, UploadedPicture } from '../session'
import { PictureUploading, type UploadingLabels, type UploadingPicture } from './picture-uploading'
import { placeholderPosition, uploadsKey } from './uploads'

type Pending = { id: string; file: File; renderer: ReactRenderer }

const preloadLimit = 4000

async function measured(file: File): Promise<{ width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file)
    const size = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return size
  } catch {
    return { width: 0, height: 0 }
  }
}

function preloaded(address: string): Promise<void> {
  return new Promise(resolve => {
    const picture = new Image()
    const settle = () => resolve()
    picture.addEventListener('load', settle)
    picture.addEventListener('error', settle)
    window.setTimeout(settle, preloadLimit)
    picture.src = address
  })
}

function insertionPoint(state: EditorState): number {
  const { $from } = state.selection
  if ($from.depth === 0) {
    return $from.pos
  }
  const block = $from.node(1)
  const blank = block.type.name === 'paragraph' && block.content.size === 0
  return blank ? $from.before(1) : $from.after(1)
}

function boundaryNear(state: EditorState, position: number): number {
  const resolved = state.doc.resolve(Math.min(position, state.doc.content.size))
  return resolved.depth === 0 ? resolved.pos : resolved.after(1)
}

function place(editor: Editor, pending: Pending, stored: UploadedPicture | undefined): void {
  if (editor.isDestroyed) {
    return
  }
  const { state, schema } = editor
  const at = placeholderPosition(state, pending.id)
  const transaction = state.tr.setMeta(uploadsKey, { remove: pending.id })
  const image = schema.nodes.image_block
  if (stored !== undefined && at !== undefined && image !== undefined) {
    const node = image.create({
      ...stored,
      alt: '',
      caption: '',
      width_percent: initialPercent(stored.width, editor.view.dom.clientWidth),
    })
    transaction.insert(at, node)
    const after = transaction.doc.resolve(at + node.nodeSize)
    if (after.nodeAfter === null && schema.nodes.paragraph !== undefined) {
      transaction.insert(after.pos, schema.nodes.paragraph.create())
    }
  }
  editor.view.dispatch(transaction)
}

function settle(editor: Editor, pending: Pending, stored: UploadedPicture | undefined): void {
  place(editor, pending, stored)
  pending.renderer.destroy()
}

async function send(editor: Editor, session: EditorSession, pending: Pending): Promise<void> {
  const upload = session.upload.get()
  if (upload === undefined || editor.isDestroyed) {
    settle(editor, pending, undefined)
    return
  }
  pending.renderer.updateProps({ failure: undefined, percent: 0 })
  session.uploading.set(session.uploading.get() + 1)
  const report = (percent: number) => pending.renderer.updateProps({ percent })
  const outcome = await upload(pending.file, report).finally(() =>
    session.uploading.set(session.uploading.get() - 1),
  )
  if (outcome.ok) {
    await preloaded(session.resolvePicture.get()(outcome.picture.src))
    settle(editor, pending, outcome.picture)
    return
  }
  pending.renderer.updateProps({
    failure: outcome.reason,
    onRetry: () => void send(editor, session, pending),
    onDrop: () => settle(editor, pending, undefined),
  })
}

export async function uploadPictures(
  editor: Editor,
  session: EditorSession,
  files: readonly File[],
  labels: UploadingLabels,
  position?: number,
): Promise<void> {
  if (session.upload.get() === undefined || files.length === 0) {
    return
  }
  const at =
    position === undefined ? insertionPoint(editor.state) : boundaryNear(editor.state, position)
  const waiting: Pending[] = []
  for (const file of files) {
    const size = await measured(file)
    if (editor.isDestroyed) {
      return
    }
    const props: UploadingPicture = { labels, ...size }
    const renderer = new ReactRenderer(PictureUploading, { editor, props })
    const id = crypto.randomUUID()
    const anchored = placeholderPosition(editor.state, waiting[0]?.id ?? '') ?? at
    editor.view.dispatch(
      editor.state.tr.setMeta(uploadsKey, {
        add: { id, position: anchored, element: renderer.element },
      }),
    )
    waiting.push({ id, file, renderer })
  }
  for (const pending of waiting) {
    await send(editor, session, pending)
  }
}
