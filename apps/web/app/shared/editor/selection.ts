import type { OverlayAnchor } from '@hina-ui/react'
import { linkAddressFrom } from '~/shared/richtext/rich-text.schema'
import type { RichEditor } from './plugin'

export function rangeRect(editor: RichEditor, from: number, to: number): DOMRect {
  const size = editor.state.doc.content.size
  const start = editor.view.coordsAtPos(Math.min(from, size))
  const end = editor.view.coordsAtPos(Math.min(to, size))
  const left = Math.min(start.left, end.left)
  const top = Math.min(start.top, end.top)
  const right = Math.max(start.right, end.right)
  const bottom = Math.max(start.bottom, end.bottom)
  return new DOMRect(left, top, right - left, bottom - top)
}

function selectionRect(editor: RichEditor): DOMRect {
  const { from, to } = editor.state.selection
  return rangeRect(editor, from, to)
}

export function selectionAnchor(editor: RichEditor): OverlayAnchor {
  return { contextElement: editor.view.dom, getBoundingClientRect: () => selectionRect(editor) }
}

export function linkAtSelection(editor: RichEditor): string {
  return linkAddressFrom(editor.getAttributes('link').href) ?? ''
}
