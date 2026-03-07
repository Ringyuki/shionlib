'use client'

import { useRef, useCallback, useState, useLayoutEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  TextQuote,
  EyeOff,
  ShieldCheck,
  Link,
} from 'lucide-react'
import { Textarea } from '@/components/shionui/Textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shionui/Tooltip'
import { BBCodeContent } from './BBCode'
import { cn } from '@/utils/cn'

interface ToolbarItem {
  open: string
  close: string
  icon: React.ReactNode
  labelKey: string
}
const MODE = ['write', 'preview'] as const
type Mode = (typeof MODE)[number]
const TOOLBAR: ToolbarItem[] = [
  { open: '[b]', close: '[/b]', icon: <Bold className="size-3.5" />, labelKey: 'bold' },
  { open: '[i]', close: '[/i]', icon: <Italic className="size-3.5" />, labelKey: 'italic' },
  { open: '[u]', close: '[/u]', icon: <Underline className="size-3.5" />, labelKey: 'underline' },
  {
    open: '[s]',
    close: '[/s]',
    icon: <Strikethrough className="size-3.5" />,
    labelKey: 'strikethrough',
  },
  {
    open: '[quote]',
    close: '[/quote]',
    icon: <TextQuote className="size-3.5" />,
    labelKey: 'quote',
  },
  {
    open: '[spoiler]',
    close: '[/spoiler]',
    icon: <EyeOff className="size-3.5" />,
    labelKey: 'spoiler',
  },
  // {
  //   open: '[mask]',
  //   close: '[/mask]',
  //   icon: <ShieldCheck className="size-3.5" />,
  //   labelKey: 'mask',
  // },
  { open: '[url]', close: '[/url]', icon: <Link className="size-3.5" />, labelKey: 'url' },
]

export interface BBCodeEditorProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  maxLength?: number
  rows?: number
  className?: string
  disabled?: boolean
  previewClassName?: string
}

export function BBCodeEditor({
  value = '',
  onValueChange,
  placeholder,
  maxLength,
  rows = 4,
  className,
  disabled,
  previewClassName,
}: BBCodeEditorProps) {
  const t = useTranslations('Components.Common.Content.BBCodeEditor')
  const [mode, setMode] = useState<Mode>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingCursorRef = useRef<[number, number] | null>(null)

  // Restore cursor position after React re-renders the controlled textarea
  useLayoutEffect(() => {
    if (pendingCursorRef.current && textareaRef.current) {
      const [start, end] = pendingCursorRef.current
      textareaRef.current.setSelectionRange(start, end)
      pendingCursorRef.current = null
    }
  })

  const insertWrap = useCallback(
    (open: string, close: string) => {
      const ta = textareaRef.current
      if (!ta || disabled) return

      const start = ta.selectionStart ?? 0
      const end = ta.selectionEnd ?? 0
      const selected = value.slice(start, end)
      const newValue = value.slice(0, start) + open + selected + close + value.slice(end)

      if (maxLength !== undefined && newValue.length > maxLength) return

      pendingCursorRef.current = [start + open.length, start + open.length + selected.length]
      onValueChange?.(newValue)
      ta.focus()
    },
    [value, onValueChange, disabled, maxLength],
  )

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between border border-b-0 rounded-t-md px-1.5 py-1 bg-muted/30">
        <div className="flex gap-0.5">
          {MODE.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-sm transition-colors',
                mode === m
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(m)}
            </button>
          ))}
        </div>

        {mode === 'write' && (
          <div className="flex items-center gap-0.5">
            {TOOLBAR.map(item => (
              <Tooltip key={item.labelKey}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => insertWrap(item.open, item.close)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {item.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <span>{t(item.labelKey)}</span>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>

      {mode === 'write' ? (
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={e => onValueChange?.(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            rows={rows}
            disabled={disabled}
            className="rounded-t-none focus-visible:z-10"
          />
          {maxLength !== undefined && (
            <span className="absolute bottom-2 right-3 text-xs text-muted-foreground/50 pointer-events-none select-none tabular-nums">
              {value.length}/{maxLength}
            </span>
          )}
        </div>
      ) : (
        <div
          className={cn(
            'border rounded-b-md min-h-16 px-3 py-2 bg-transparent text-sm',
            previewClassName,
          )}
        >
          {value.trim() ? (
            <BBCodeContent content={value} />
          ) : (
            <span className="text-muted-foreground">{t('previewEmpty')}</span>
          )}
        </div>
      )}
    </div>
  )
}
