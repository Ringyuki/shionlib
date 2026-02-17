'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { CheckIcon, LoaderCircleIcon, XIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { ScrollArea } from './ScrollArea'
import { Badge } from './Badge'
import { useTranslations } from 'next-intl'
import { cn } from '@/utils/cn'

type Size = 'sm' | 'default'

type AsyncMultiSelectContextValue = {
  selectedValues: string[]
  setSelectedValues: (next: string[]) => void
  isSelected: (value: string) => boolean
  toggleValue: (value: string) => void
  registerItem: (value: string, label: React.ReactNode) => void
  unregisterItem: (value: string) => void
  getLabel: (value: string) => React.ReactNode
  disabled?: boolean
  highlightedValue: string | null
  setHighlightedValue: (value: string | null) => void
  itemValues: string[]
  loading?: boolean
  clearOnSelect?: boolean
  clearSearch?: () => void
}

const AsyncMultiSelectContext = React.createContext<AsyncMultiSelectContextValue | null>(null)

function useAsyncMultiSelectContext(): AsyncMultiSelectContextValue {
  const ctx = React.useContext(AsyncMultiSelectContext)
  if (!ctx) throw new Error('AsyncMultiSelect components must be used within <AsyncMultiSelect>')
  return ctx
}

type AsyncMultiSelectProps = Omit<
  React.ComponentProps<typeof PopoverPrimitive.Root>,
  'onOpenChange' | 'open'
> & {
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (values: string[]) => void
  onSearch?: (query: string) => void
  disabled?: boolean
  loading?: boolean
  debounceMs?: number
  placeholder?: string
  size?: Size
  open?: boolean
  onOpenChange?: (open: boolean) => void
  clearOnSelect?: boolean
}

function AsyncMultiSelect({
  value,
  defaultValue,
  onValueChange,
  onSearch,
  disabled,
  loading = false,
  debounceMs = 300,
  placeholder,
  size = 'default',
  open: controlledOpen,
  onOpenChange,
  clearOnSelect = false,
  children,
  ...props
}: AsyncMultiSelectProps) {
  const isControlled = value !== undefined
  const [internalValues, setInternalValues] = React.useState<string[]>(defaultValue ?? [])
  const current = isControlled ? (value as string[]) : internalValues
  const t = useTranslations('Components.ShionUI.AsyncMultiSelect')

  const [open, setOpen] = React.useState(false)
  const isOpenControlled = controlledOpen !== undefined
  const currentOpen = isOpenControlled ? controlledOpen : open
  const inputRefFromTrigger = React.useRef<HTMLInputElement>(null)

  const handleOpenChange = (newOpen: boolean) => {
    if (!isOpenControlled) setOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  const setSelectedValues = (next: string[]) => {
    if (!isControlled) setInternalValues(next)
    onValueChange?.(next)
  }

  const isSelected = (val: string) => current.includes(val)
  const toggleValue = (val: string) => {
    const next = isSelected(val) ? current.filter(v => v !== val) : [...current, val]
    setSelectedValues(next)
  }

  const removeValue = (val: string) => {
    const next = current.filter(v => v !== val)
    setSelectedValues(next)
  }

  const labelsRef = React.useRef<Map<string, React.ReactNode>>(new Map())
  const [itemValues, setItemValues] = React.useState<string[]>([])
  const [highlightedValue, setHighlightedValue] = React.useState<string | null>(null)
  const clearSearchRef = React.useRef<(() => void) | undefined>(undefined)

  const registerItem = React.useCallback((val: string, label: React.ReactNode) => {
    labelsRef.current.set(val, label)
    setItemValues(prev => {
      if (!prev.includes(val)) {
        return [...prev, val]
      }
      return prev
    })
  }, [])

  const unregisterItem = React.useCallback((val: string) => {
    labelsRef.current.delete(val)
    setItemValues(prev => prev.filter(v => v !== val))
  }, [])

  const getLabel = React.useCallback((val: string) => labelsRef.current.get(val) ?? val, [])

  return (
    <PopoverPrimitive.Root open={currentOpen} onOpenChange={handleOpenChange} {...props}>
      <AsyncMultiSelectContext.Provider
        value={{
          selectedValues: current,
          setSelectedValues,
          isSelected,
          toggleValue,
          registerItem,
          unregisterItem,
          getLabel,
          disabled,
          highlightedValue,
          setHighlightedValue,
          itemValues,
          loading,
          clearOnSelect,
          clearSearch: () => clearSearchRef.current?.(),
        }}
      >
        <AsyncMultiSelectTrigger
          size={size}
          placeholder={placeholder || t('placeholder')}
          onSearch={onSearch}
          debounceMs={debounceMs}
          removeValue={removeValue}
          onOpenChange={handleOpenChange}
          inputRef={inputRefFromTrigger}
          open={currentOpen}
          clearOnSelect={clearOnSelect}
          clearSearchRef={clearSearchRef}
        />
        {children}
      </AsyncMultiSelectContext.Provider>
    </PopoverPrimitive.Root>
  )
}

type AsyncMultiSelectTriggerProps = {
  size?: Size
  placeholder?: string
  onSearch?: (query: string) => void
  debounceMs?: number
  removeValue: (value: string) => void
  onOpenChange: (open: boolean) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  open: boolean
  clearOnSelect?: boolean
  clearSearchRef: React.MutableRefObject<(() => void) | undefined>
}

function AsyncMultiSelectTrigger({
  size = 'default',
  placeholder,
  onSearch,
  debounceMs = 300,
  removeValue,
  onOpenChange,
  inputRef,
  open,
  clearOnSelect = false,
  clearSearchRef,
}: AsyncMultiSelectTriggerProps) {
  const {
    selectedValues,
    getLabel,
    disabled,
    loading,
    itemValues,
    highlightedValue,
    setHighlightedValue,
    toggleValue,
  } = useAsyncMultiSelectContext()
  const [searchQuery, setSearchQuery] = React.useState('')
  const debounceTimerRef = React.useRef<NodeJS.Timeout | undefined>(undefined)

  React.useEffect(() => {
    clearSearchRef.current = () => setSearchQuery('')
  }, [clearSearchRef])

  const handleToggleValue = React.useCallback(
    (value: string) => {
      toggleValue(value)
      if (clearOnSelect) {
        setSearchQuery('')
      }
    },
    [toggleValue, clearOnSelect],
  )

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)

    onOpenChange(true)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      onSearch?.(query)
    }, debounceMs)
  }

  const handleInputFocus = () => {
    if (!disabled) {
      onOpenChange(true)
    }
  }

  const handleInputBlur = (e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement
    if (!relatedTarget || !relatedTarget.closest('[data-slot="async-select-content"]')) {
      setTimeout(() => {
        onOpenChange(false)
      }, 150)
    }
  }

  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('button')) {
      return
    }

    inputRef.current?.focus()
    if (!open) {
      onOpenChange(true)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!itemValues.length) {
      if (e.key === 'Backspace' && !searchQuery && selectedValues.length > 0) {
        e.preventDefault()
        removeValue(selectedValues[selectedValues.length - 1])
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        const currentIndex = highlightedValue ? itemValues.indexOf(highlightedValue) : -1
        const nextIndex = currentIndex < itemValues.length - 1 ? currentIndex + 1 : 0
        setHighlightedValue(itemValues[nextIndex])
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const currentIndex = highlightedValue ? itemValues.indexOf(highlightedValue) : -1
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : itemValues.length - 1
        setHighlightedValue(itemValues[prevIndex])
        break
      }
      case 'Enter': {
        e.preventDefault()
        if (highlightedValue) {
          handleToggleValue(highlightedValue)
          inputRef.current?.focus()
        }
        break
      }
      case 'Escape': {
        e.preventDefault()
        onOpenChange(false)
        inputRef.current?.blur()
        break
      }
      case 'Backspace': {
        if (!searchQuery && selectedValues.length > 0) {
          e.preventDefault()
          removeValue(selectedValues[selectedValues.length - 1])
        }
        break
      }
    }
  }

  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return (
    <PopoverPrimitive.Anchor asChild>
      <div
        data-slot="async-select-trigger"
        data-size={size}
        className={cn(
          'bg-input/30 border-input data-[placeholder]:text-muted-foreground focus-within:border-ring focus-within:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-input/50 flex w-full flex-wrap items-center gap-1.5 rounded-md border px-3 py-1 shadow-xs transition-all outline-none focus-within:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 duration-200',
          size === 'default' && 'h-9',
          size === 'sm' && 'h-8',
          disabled && 'pointer-events-none',
        )}
        onClick={handleContainerClick}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {selectedValues.map(val => (
            <motion.div
              key={val}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <Badge
                variant="neutral"
                size={size === 'sm' ? 'sm' : 'md'}
                className="group flex items-center gap-1 pr-1"
              >
                <span className="truncate max-w-[200px]">{getLabel(val)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${getLabel(val)}`}
                  className="hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full p-0.5 transition-colors duration-150"
                  onMouseDown={e => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  onClick={e => {
                    e.stopPropagation()
                    removeValue(val)
                  }}
                  disabled={disabled}
                  tabIndex={-1}
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="flex flex-1 items-center gap-2 min-w-[120px]">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder={selectedValues.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="placeholder:text-muted-foreground flex-1 leading-5 outline-none"
          />
          <span className="inline-flex w-4 h-4 flex-shrink-0">
            <motion.span
              key="loader"
              initial={false}
              animate={{ opacity: loading ? 1 : 0 }}
              transition={{ duration: 0.1 }}
              className="inline-flex"
            >
              <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
            </motion.span>
          </span>
        </div>
      </div>
    </PopoverPrimitive.Anchor>
  )
}

function AsyncMultiSelectContent({
  className,
  children,
  sideOffset = 4,
  emptyMessage,
  onInteractOutside,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & { emptyMessage?: string }) {
  const { itemValues, highlightedValue, loading } = useAsyncMultiSelectContext()
  const contentRef = React.useRef<HTMLDivElement>(null)
  const t = useTranslations('Components.ShionUI.AsyncMultiSelect')

  React.useEffect(() => {
    if (highlightedValue && contentRef.current) {
      const highlightedElement = contentRef.current.querySelector(
        `[data-value="${highlightedValue}"]`,
      ) as HTMLElement
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [highlightedValue])

  const handleInteractOutside: React.ComponentProps<
    typeof PopoverPrimitive.Content
  >['onInteractOutside'] = e => {
    const target = e.target as HTMLElement
    if (target.closest('[data-slot="async-select-trigger"]')) {
      e.preventDefault()
      return
    }
    onInteractOutside?.(e)
  }

  const showEmpty = itemValues.length === 0

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={contentRef}
        sideOffset={sideOffset}
        data-slot="async-select-content"
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-popover-content-available-height) min-w-[8rem] origin-(--radix-popover-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border shadow-md w-[var(--radix-popper-anchor-width)]',
          className,
        )}
        onOpenAutoFocus={e => {
          e.preventDefault()
        }}
        onInteractOutside={handleInteractOutside}
        {...props}
      >
        <ScrollArea className="max-h-[400px]">
          <div className="p-1 flex flex-col gap-1">
            {showEmpty && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage || t('emptyMessage')}
              </div>
            )}
            {children}
          </div>
        </ScrollArea>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

function AsyncMultiSelectItem({
  className,
  children,
  value,
  disabled,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onSelect'> & { value: string; disabled?: boolean }) {
  const {
    isSelected,
    toggleValue,
    registerItem,
    unregisterItem,
    highlightedValue,
    setHighlightedValue,
    clearOnSelect,
    clearSearch,
  } = useAsyncMultiSelectContext()

  React.useEffect(() => {
    registerItem(value, children)
  }, [value, registerItem])

  React.useEffect(() => {
    return () => unregisterItem(value)
  }, [value, unregisterItem])

  const selected = isSelected(value)
  const highlighted = highlightedValue === value

  const handleClick = () => {
    if (disabled) return
    toggleValue(value)
    if (clearOnSelect && clearSearch) {
      clearSearch()
    }
  }

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      tabIndex={-1}
      data-slot="async-select-item"
      data-value={value}
      data-highlighted={highlighted}
      className={cn(
        "transition-all duration-200 [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        highlighted && !selected && 'bg-primary/10 text-primary',
        selected && 'bg-primary text-primary-foreground',
        className,
      )}
      onMouseEnter={() => !disabled && setHighlightedValue(value)}
      onMouseDown={e => {
        e.preventDefault()
      }}
      onClick={e => {
        e.preventDefault()
        handleClick()
      }}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        {selected && <CheckIcon className="size-4 text-primary-foreground" />}
      </span>
      <span>{children}</span>
    </div>
  )
}

function AsyncMultiSelectSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="async-select-separator"
      className={cn('bg-border pointer-events-none -mx-1 my-1 h-px', className)}
      {...props}
    />
  )
}

function AsyncMultiSelectGroup({ ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="async-select-group" {...props} />
}

function AsyncMultiSelectLabel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="async-select-label"
      className={cn('text-muted-foreground px-2 py-1.5 text-xs font-medium', className)}
      {...props}
    />
  )
}

export {
  AsyncMultiSelect,
  AsyncMultiSelectContent,
  AsyncMultiSelectItem,
  AsyncMultiSelectSeparator,
  AsyncMultiSelectGroup,
  AsyncMultiSelectLabel,
}
