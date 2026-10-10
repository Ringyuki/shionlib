import { cn, Prose, Stack, Text } from '@hina-ui/react'
import { useLayoutEffect } from 'react'
import type { EditorHandle } from '../use-rich-editor'

type EditorSurfaceProps = { handle: EditorHandle; label: string; contentClassName?: string }

const scrollEdge = 5

export function EditorSurface({ handle, label, contentClassName }: EditorSurfaceProps) {
  const { editor, Content, placeholder } = handle
  const content = cn('rich-editor hn-prose', contentClassName)
  useLayoutEffect(() => {
    editor?.setOptions({
      editorProps: {
        scrollMargin: scrollEdge,
        scrollThreshold: scrollEdge,
        attributes: {
          class: content,
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': label,
        },
      },
    })
  }, [editor, label, content])
  if (Content === null) {
    return (
      <Stack gap="none">
        <Prose className={content}>
          <Text as="p" size="inherit" tone="faint">
            {placeholder}
          </Text>
        </Prose>
      </Stack>
    )
  }
  return <Content editor={editor} />
}
