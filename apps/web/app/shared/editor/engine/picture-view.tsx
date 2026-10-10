import { cn, Stack, Tag } from '@hina-ui/react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useRef, useState } from 'react'
import { useTranslations } from 'use-intl'
import { captionLimits, pictureFrom } from '~/shared/richtext/rich-text.schema'
import { PictureFigure } from '~/shared/ui/picture-figure'
import { widestPercent } from '../picture-size'
import { PictureCaption } from './picture-caption'
import { PictureTools } from './picture-tools'
import { usePictureResize } from './use-picture-resize'

const corners = [
  { id: 'top-start', side: -1, place: '-top-1.5 -start-1.5 cursor-nwse-resize' },
  { id: 'top-end', side: 1, place: '-top-1.5 -end-1.5 cursor-nesw-resize' },
  { id: 'bottom-start', side: -1, place: '-bottom-1.5 -start-1.5 cursor-nesw-resize' },
  { id: 'bottom-end', side: 1, place: '-bottom-1.5 -end-1.5 cursor-nwse-resize' },
] as const

export function PictureView(props: NodeViewProps) {
  const { node, editor, selected, updateAttributes, deleteNode } = props
  const t = useTranslations('editor')
  const column = useRef<HTMLDivElement>(null)
  const [captioning, setCaptioning] = useState(false)
  const stored = pictureFrom(node.attrs)
  const resize = usePictureResize(column, stored, percent =>
    updateAttributes({ width_percent: percent }),
  )
  if (stored === undefined) {
    return <NodeViewWrapper />
  }
  const widest = widestPercent(stored.width, editor.view.dom.clientWidth)
  const percent = resize.dragged ?? Math.min(stored.widthPercent, widest)
  const picture = { ...stored, widthPercent: percent }
  const active = selected || captioning
  return (
    <NodeViewWrapper ref={column} data-drag-handle="">
      <PictureFigure
        picture={picture}
        eager
        caption={
          (active || stored.caption !== '') && (
            <Stack
              gap="none"
              data-picture-caption=""
              className="w-full"
              onFocus={() => setCaptioning(true)}
              onBlur={() => setCaptioning(false)}
            >
              <PictureCaption
                stored={stored.caption}
                label={t('pictureCaption')}
                hint={t('pictureCaptionHint')}
                onChange={caption =>
                  updateAttributes({ caption, alt: caption.slice(0, captionLimits.alt) })
                }
              />
            </Stack>
          )
        }
      >
        {active && resize.dragged === undefined && (
          <PictureTools
            percent={percent}
            widest={widest}
            onResize={next => updateAttributes({ width_percent: next })}
            onRemove={deleteNode}
          />
        )}
        {resize.dragged !== undefined && (
          <Tag size="sm" className="absolute start-2 top-2 tabular-nums">
            {resize.dragged}%
          </Tag>
        )}
        {selected &&
          corners.map(corner => (
            <Stack
              key={corner.id}
              gap="none"
              aria-hidden
              className={cn(
                'border-accent bg-surface absolute z-10 size-3 rounded-sm border-2 shadow-sm',
                corner.place,
              )}
              onPointerDown={resize.start(corner.side)}
            />
          ))}
      </PictureFigure>
    </NodeViewWrapper>
  )
}
