'use client'

import * as React from 'react'
import { XIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import { cn } from '@/utils/cn'

type TextareaSize = 'sm' | 'md' | 'lg'
type AutosizeOption = boolean | { minRows?: number; maxRows?: number }

type TextareaProps = React.ComponentProps<'textarea'> & {
  size?: TextareaSize
  clearable?: boolean
  onClear?: () => void
  autosize?: AutosizeOption
}

const sizeClasses: Record<TextareaSize, string> = {
  sm: 'text-sm px-3 py-2',
  md: 'md:text-sm px-3 py-2',
  lg: 'text-base px-4 py-3',
}

const verticalPadding: Record<TextareaSize, string> = {
  sm: '1rem',
  md: '1rem',
  lg: '1.5rem',
}

const resolveAutosize = (autosize: AutosizeOption) => {
  if (autosize === false) return { enabled: false, minRows: undefined, maxRows: undefined }
  if (autosize === true) return { enabled: true, minRows: 4, maxRows: 12 }
  return { enabled: true, minRows: autosize.minRows ?? 4, maxRows: autosize.maxRows ?? 12 }
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, size = 'md', clearable, onClear, autosize = true, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement>(null)
    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement)

    const isControlled = props.value !== undefined
    const [hasValue, setHasValue] = React.useState(
      isControlled ? String((props.value as unknown as string) ?? '').length > 0 : false,
    )

    React.useEffect(() => {
      if (isControlled) {
        setHasValue(String((props.value as unknown as string) ?? '').length > 0)
      }
    }, [isControlled, props.value])

    const handleClear = () => {
      const target = innerRef.current
      if (!target) return
      const isControlled = props.value !== undefined
      if (!isControlled) {
        target.value = ''
        target.dispatchEvent(new Event('input', { bubbles: true }))
        target.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        const e = { target: { value: '' } } as unknown as React.ChangeEvent<HTMLTextAreaElement>
        props.onChange?.(e)
      }
      onClear?.()
      target.focus()
    }

    const handleInput: React.FormEventHandler<HTMLTextAreaElement> = e => {
      if (!isControlled) {
        setHasValue((e.currentTarget.value?.length ?? 0) > 0)
      }
      props.onInput?.(e)
    }

    const { enabled, minRows, maxRows } = resolveAutosize(autosize)
    const vp = verticalPadding[size]
    const autosizeStyle: React.CSSProperties = enabled
      ? {
          minHeight: `calc(${minRows} * 1lh + ${vp})`,
          ...(maxRows !== undefined && { maxHeight: `calc(${maxRows} * 1lh + ${vp})` }),
        }
      : {}

    return (
      <div data-slot="textarea-wrapper" className={cn('relative w-full')}>
        <textarea
          ref={innerRef}
          data-slot="textarea"
          className={cn(
            'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex w-full rounded-md border bg-transparent md:text-sm text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
            enabled && 'field-sizing-content resize-none',
            enabled && maxRows !== undefined && 'overflow-y-auto',
            sizeClasses[size],
            className,
          )}
          style={{ ...autosizeStyle, ...props.style }}
          onInput={handleInput}
          {...props}
        />
        <AnimatePresence initial={false}>
          {!!clearable && hasValue && (
            <motion.button
              type="button"
              aria-label="Clear textarea"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 hover:bg-primary/10 active:bg-primary/20 rounded-full duration-250"
              onClick={handleClear}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              <XIcon className="size-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'

export { Textarea }
