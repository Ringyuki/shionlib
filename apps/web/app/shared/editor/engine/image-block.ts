import { mergeAttributes, Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { pictureAttrsFromText } from '~/shared/richtext/rich-text.schema'
import { fullPercent } from '../picture-size'
import type { EditorSession } from '../session'
import type { UploadingLabels } from './picture-uploading'
import { uploadPictures } from './picture-upload'
import { PictureView } from './picture-view'
import { uploadsPlugin } from './uploads'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      insertPictures: (files: readonly File[], position?: number) => ReturnType
    }
  }
}

const transferKey = new PluginKey('pictureTransfer')

const pictureAttribute = 'data-picture'

function picturesIn(transfer: DataTransfer | null): File[] {
  return [...(transfer?.files ?? [])].filter(file => file.type.startsWith('image/'))
}

export function imageBlock(session: EditorSession, labels: UploadingLabels) {
  return Node.create({
    name: 'image_block',
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,

    addAttributes() {
      return {
        src: { default: '', rendered: false },
        alt: { default: '', rendered: false },
        caption: { default: '', rendered: false },
        width: { default: 0, rendered: false },
        height: { default: 0, rendered: false },
        width_percent: { default: fullPercent, rendered: false },
      }
    },

    parseHTML() {
      return [
        {
          tag: `figure[${pictureAttribute}]`,
          getAttrs: element =>
            pictureAttrsFromText(element.getAttribute(pictureAttribute)) ?? false,
        },
      ]
    },

    renderHTML({ node, HTMLAttributes }) {
      return [
        'figure',
        mergeAttributes(HTMLAttributes, { [pictureAttribute]: JSON.stringify(node.attrs) }),
      ]
    },

    addNodeView() {
      return ReactNodeViewRenderer(PictureView)
    },

    addCommands() {
      return {
        insertPictures:
          (files, position) =>
          ({ editor }) => {
            void uploadPictures(editor, session, files, labels, position)
            return true
          },
      }
    },

    addProseMirrorPlugins() {
      const editor = this.editor
      return [
        uploadsPlugin(),
        new Plugin({
          key: transferKey,
          props: {
            handlePaste(_, event) {
              const files = picturesIn(event.clipboardData)
              if (files.length === 0 || session.upload.get() === undefined) {
                return false
              }
              editor.commands.insertPictures(files)
              return true
            },
            handleDrop(view, event) {
              const files = picturesIn(event.dataTransfer)
              if (files.length === 0 || session.upload.get() === undefined) {
                return false
              }
              const dropped = view.posAtCoords({ left: event.clientX, top: event.clientY })
              editor.commands.insertPictures(files, dropped?.pos)
              return true
            },
          },
        }),
      ]
    },
  })
}
