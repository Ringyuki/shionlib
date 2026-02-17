'use client'

import * as React from 'react'
import { XIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import { cn } from '@/utils/cn'

type InputSize = 'sm' | 'md' | 'lg'

type InputProps = Omit<React.ComponentProps<'input'>, 'prefix' | 'suffix' | 'size'> & {
  size?: InputSize
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  clearable?: boolean
  onClear?: () => void
  inputClassName?: string
  rightSlot?: React.ReactNode
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'h-8 text-sm px-3 py-1',
  md: 'h-9 md:text-sm px-3 py-1',
  lg: 'h-10 text-base px-4 py-2',
}

const calcPadding = (base: string, hasPrefix: boolean, hasSuffixOrClear: boolean): string => {
  return cn(base, hasPrefix && 'pl-9', hasSuffixOrClear && 'pr-12')
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      size = 'md' as InputSize,
      prefix,
      suffix,
      clearable,
      onClear,
      inputClassName,
      rightSlot,
      ...props
    },
    ref,
  ) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

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
      const target = inputRef.current
      if (!target) return
      const isControlled = props.value !== undefined
      if (!isControlled) {
        target.value = ''
        target.dispatchEvent(new Event('input', { bubbles: true }))
        target.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        const e = { target: { value: '' } } as unknown as React.ChangeEvent<HTMLInputElement>
        props.onChange?.(e)
      }
      onClear?.()
      target.focus()
    }

    const showClear = !!clearable && hasValue

    const handleInput: React.FormEventHandler<HTMLInputElement> = e => {
      if (!isControlled) {
        setHasValue((e.currentTarget.value?.length ?? 0) > 0)
      }
      props.onInput?.(e)
    }

    const baseClass = calcPadding(
      sizeClasses[size],
      !!prefix,
      !!suffix || !!clearable || !!rightSlot,
    )

    return (
      <div data-slot="input-wrapper" className={cn('relative w-full min-w-0', className)}>
        {prefix && (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground inline-flex items-center justify-center">
            {prefix}
          </span>
        )}
        <input
          ref={inputRef}
          type={type}
          data-slot="input"
          className={cn(
            'bg-input/30 file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input flex w-full min-w-0 rounded-md border text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            baseClass,
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
            inputClassName,
          )}
          onInput={handleInput}
          {...props}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1">
          <AnimatePresence initial={false}>
            {showClear && (
              <motion.button
                type="button"
                aria-label="Clear input"
                className="p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 hover:bg-primary/10 active:bg-primary/20 rounded-full duration-250"
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
          {suffix && (
            <span className="pointer-events-none text-muted-foreground inline-flex items-center justify-center">
              {suffix}
            </span>
          )}
          {rightSlot}
        </div>
      </div>
    )
  },
)

Input.displayName = 'Input'

export { Input }
