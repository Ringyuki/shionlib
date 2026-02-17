'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { ScrollArea } from './ScrollArea'

import { cn } from '@/utils/cn'

type Size = 'sm' | 'default'

type MultiSelectContextValue = {
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
}

const MultiSelectContext = React.createContext<MultiSelectContextValue | null>(null)

function useMultiSelectContext(): MultiSelectContextValue {
  const ctx = React.useContext(MultiSelectContext)
  if (!ctx) throw new Error('MultiSelect components must be used within <MultiSelect>')
  return ctx
}

type Primitive = string | number

type MultiSelectProps<T extends Primitive = string> = Omit<
  React.ComponentProps<typeof PopoverPrimitive.Root>,
  'onOpenChange' | 'open'
> & {
  value?: T[]
  defaultValue?: T[]
  onValueChange?: (values: T[]) => void
  disabled?: boolean
}

function MultiSelect<T extends Primitive = string>({
  value,
  defaultValue,
  onValueChange,
  disabled,
  children,
  ...props
}: MultiSelectProps<T>) {
  const isControlled = value !== undefined
  const [internalValues, setInternalValues] = React.useState<string[]>(
    (defaultValue?.map(String) as string[]) ?? [],
  )
  const current = isControlled ? ((value as T[]).map(String) as string[]) : internalValues

  const setSelectedValues = (next: string[]) => {
    if (!isControlled) setInternalValues(next)
    if (onValueChange) {
      const sample = isControlled ? (value as T[])[0] : (defaultValue as T[] | undefined)?.[0]
      const isNumber = typeof sample === 'number'
      const typedNext = isNumber
        ? (next.map(v => Number(v)) as unknown as T[])
        : (next as unknown as T[])
      onValueChange(typedNext)
    }
  }

  const isSelected = (val: string) => current.includes(val)
  const toggleValue = (val: string) => {
    const next = isSelected(val) ? current.filter(v => v !== val) : [...current, val]
    setSelectedValues(next)
  }

  const labelsRef = React.useRef<Map<string, React.ReactNode>>(new Map())
  const [itemValues, setItemValues] = React.useState<string[]>([])
  const [highlightedValue, setHighlightedValue] = React.useState<string | null>(null)

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
    <PopoverPrimitive.Root {...props}>
      <MultiSelectContext.Provider
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
        }}
      >
        {children}
      </MultiSelectContext.Provider>
    </PopoverPrimitive.Root>
  )
}

function MultiSelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger> & { size?: Size }) {
  return (
    <PopoverPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "transition-all duration-200 bg-input/30 text-sm border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive not-disabled:hover:bg-input/50 flex w-fit max-w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2 whitespace-nowrap shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 [&>[data-slot=select-value]]:min-w-0 [&>[data-slot=select-value]]:flex-1 [&>[data-slot=select-value]]:overflow-hidden [&>[data-slot=select-value]]:text-left [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="size-4 opacity-50" />
    </PopoverPrimitive.Trigger>
  )
}

function MultiSelectContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  const { itemValues, highlightedValue, setHighlightedValue, toggleValue } = useMultiSelectContext()
  const contentRef = React.useRef<HTMLDivElement>(null)

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!itemValues.length) return

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
            toggleValue(highlightedValue)
          }
          break
        }
        case 'Escape': {
          e.preventDefault()
          break
        }
      }
    },
    [itemValues, highlightedValue, setHighlightedValue, toggleValue],
  )

  // React.useEffect(() => {
  //   if (highlightedValue && contentRef.current) {
  //     const highlightedElement = contentRef.current.querySelector(
  //       `[data-value="${highlightedValue}"]`,
  //     ) as HTMLElement
  //     if (highlightedElement) {
  //       highlightedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  //     }
  //   }
  // }, [highlightedValue])

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={contentRef}
        sideOffset={sideOffset}
        data-slot="select-content"
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-popover-content-available-height) min-w-[8rem] origin-(--radix-popover-content-transform-origin) overflow-x-hidden rounded-md border shadow-md w-[var(--radix-popper-anchor-width)]',
          className,
        )}
        onKeyDown={handleKeyDown}
        {...props}
      >
        <ScrollArea className="max-h-[300px]">
          <div className="p-1 flex flex-col gap-1">{children}</div>
        </ScrollArea>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
}

function MultiSelectValue({
  placeholder,
  separator = ', ',
  className,
  resolveLabel,
}: {
  placeholder?: React.ReactNode
  separator?: string
  className?: string
  resolveLabel?: (value: string) => React.ReactNode
}) {
  const { selectedValues, getLabel } = useMultiSelectContext()
  const labels = selectedValues.map(v => resolveLabel?.(v) ?? getLabel(v))
  const hasValue = labels.length > 0
  return (
    <span
      data-slot="select-value"
      className={cn('block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap', className)}
    >
      {hasValue ? (
        <span className="inline min-w-0">
          {labels.map((l, idx) => (
            <React.Fragment key={String(idx)}>
              {idx > 0 && <span className="text-muted-foreground/70">{separator}</span>}
              <span>{l}</span>
            </React.Fragment>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground">{placeholder}</span>
      )}
    </span>
  )
}

function MultiSelectItem({
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
  } = useMultiSelectContext()

  React.useEffect(() => {
    registerItem(value, children)
  }, [value, children, registerItem])

  React.useEffect(() => {
    return () => unregisterItem(value)
  }, [value, unregisterItem])

  const selected = isSelected(value)
  const highlighted = highlightedValue === value

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-disabled={disabled}
      tabIndex={-1}
      data-slot="select-item"
      data-value={value}
      data-highlighted={highlighted}
      className={cn(
        "transition-all duration-200 [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        highlighted && !selected && 'bg-primary/10 text-primary',
        selected && 'bg-primary text-primary-foreground',
        className,
      )}
      onMouseEnter={() => !disabled && setHighlightedValue(value)}
      onClick={e => {
        e.preventDefault()
        if (disabled) return
        toggleValue(value)
      }}
      onKeyDown={e => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggleValue(value)
        }
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

function MultiSelectSeparator({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="select-separator"
      className={cn('bg-border pointer-events-none -mx-1 my-1 h-px', className)}
      {...props}
    />
  )
}

function MultiSelectGroup({ ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="select-group" {...props} />
}

function MultiSelectLabel({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="select-label"
      className={cn('text-muted-foreground px-2 py-1.5 text-xs', className)}
      {...props}
    />
  )
}

export {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectValue,
  MultiSelectSeparator,
  MultiSelectGroup,
  MultiSelectLabel,
}
