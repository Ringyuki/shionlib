import { cn, Prose, Stack, Text } from '@hina-ui/react'
import { useLayoutEffect, type ReactNode } from 'react'
import type { EditorHandle } from '../use-rich-editor'
import { SessionContext } from './session-context'

export type Clearance = { top: number; bottom: number }

type EditorSurfaceProps = {
  handle: EditorHandle
  label: string
  clearance?: Clearance
  className?: string
  contentClassName?: string
  children?: ReactNode
}

const scrollEdge = 5

const noClearance: Clearance = { top: 0, bottom: 0 }

export function EditorSurface({
  handle,
  label,
  clearance = noClearance,
  className,
  contentClassName,
  children,
}: EditorSurfaceProps) {
  const { editor, Content, session, placeholder } = handle
  const content = cn('rich-editor hn-prose', contentClassName)
  const { top, bottom } = clearance
  useLayoutEffect(() => {
    const edges = {
      top: top + scrollEdge,
      right: scrollEdge,
      bottom: bottom + scrollEdge,
      left: scrollEdge,
    }
    editor?.setOptions({
      editorProps: {
        scrollMargin: edges,
        scrollThreshold: edges,
        attributes: {
          class: content,
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': label,
        },
      },
    })
  }, [editor, label, content, top, bottom])
  if (Content === null) {
    return (
      <Stack gap="none" className={className}>
        <Prose className={content}>
          <Text as="p" size="inherit" tone="faint">
            {placeholder}
          </Text>
        </Prose>
      </Stack>
    )
  }
  return (
    <SessionContext value={session}>
      <Stack gap="none" className="relative">
        <Content editor={editor} className={className} />
        {children}
      </Stack>
    </SessionContext>
  )
}
