import type { TextareaHandle } from '@hina-ui/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { applyBBCodeTool, type BBCodeTool, type TextEdit } from '~/shared/markup/bbcode-edit'

export function useBBCodeEditor(value: string, onValueChange: (value: string) => void) {
  const textarea = useRef<TextareaHandle>(null)
  const field = useRef<HTMLDivElement>(null)
  const selection = useRef<TextEdit | undefined>(undefined)
  const [previewing, setPreviewing] = useState(false)
  const [height, setHeight] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    const input = textarea.current?.input
    const pending = selection.current
    if (input == null || pending === undefined) {
      return
    }
    selection.current = undefined
    input.focus()
    input.setSelectionRange(pending.start, pending.end)
  }, [value])

  const apply = (tool: BBCodeTool) => {
    const input = textarea.current?.input
    if (input == null) {
      return
    }
    const edit = applyBBCodeTool(
      { text: value, start: input.selectionStart, end: input.selectionEnd },
      tool,
    )
    selection.current = edit
    onValueChange(edit.text)
  }

  const preview = (next: boolean) => {
    if (next) {
      setHeight(field.current?.offsetHeight)
    }
    setPreviewing(next)
  }

  return { textarea, field, previewing, height, apply, preview }
}
