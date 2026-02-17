'use client'

import * as React from 'react'
import { XIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import { cn } from '@/utils/cn'
import { Badge } from './Badge'
import { useTranslations } from 'next-intl'

type TagsInputSize = 'sm' | 'md' | 'lg'

type TagsInputProps = Omit<React.ComponentProps<'div'>, 'onChange' | 'size'> & {
  size?: TagsInputSize
  value?: string[]
  defaultValue?: string[]
  onChange?: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
  maxTags?: number
  allowDuplicates?: boolean
  delimiter?: string | RegExp
  onTagAdd?: (tag: string) => void
  onTagRemove?: (tag: string) => void
  validate?: (tag: string) => boolean
  tagClassName?: string
  inputClassName?: string
}

const sizeClasses: Record<TagsInputSize, { container: string; input: string; badge: string }> = {
  sm: {
    container: 'min-h-8 gap-1 p-1',
    input: 'h-6 text-sm',
    badge: 'text-[11px]',
  },
  md: {
    container: 'min-h-9 gap-1.5 p-1.5',
    input: 'h-7 md:text-sm',
    badge: 'text-xs',
  },
  lg: {
    container: 'min-h-10 gap-2 p-2',
    input: 'h-8 text-base',
    badge: 'text-sm',
  },
}

const TagsInput = React.forwardRef<HTMLDivElement, TagsInputProps>(
  (
    {
      className,
      size = 'md',
      value,
      defaultValue = [],
      onChange,
      placeholder,
      disabled = false,
      maxTags,
      allowDuplicates = false,
      delimiter = ',',
      onTagAdd,
      onTagRemove,
      validate,
      tagClassName,
      inputClassName,
      ...props
    },
    ref,
  ) => {
    const t = useTranslations('Components.ShionUI.TagsInput')
    const isControlled = value !== undefined
    const [internalTags, setInternalTags] = React.useState<string[]>(defaultValue)
    const tags = isControlled ? value : internalTags
    const [inputValue, setInputValue] = React.useState('')
    const inputRef = React.useRef<HTMLInputElement>(null)
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useImperativeHandle(ref, () => containerRef.current as HTMLDivElement)

    const setTags = (newTags: string[]) => {
      if (!isControlled) {
        setInternalTags(newTags)
      }
      onChange?.(newTags)
    }

    const addTag = (tag: string) => {
      const trimmedTag = tag.trim()
      if (!trimmedTag) return

      // Validate tag
      if (validate && !validate(trimmedTag)) return

      // Check for duplicates
      if (!allowDuplicates && tags.includes(trimmedTag)) return

      // Check max tags
      if (maxTags !== undefined && tags.length >= maxTags) return

      const newTags = [...tags, trimmedTag]
      setTags(newTags)
      onTagAdd?.(trimmedTag)
      setInputValue('')
    }

    const removeTag = (index: number) => {
      const removedTag = tags[index]
      const newTags = tags.filter((_, i) => i !== index)
      setTags(newTags)
      onTagRemove?.(removedTag)
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value

      // Handle delimiter
      if (delimiter) {
        if (typeof delimiter === 'string') {
          if (newValue.includes(delimiter)) {
            const parts = newValue.split(delimiter)
            parts.slice(0, -1).forEach(part => addTag(part))
            setInputValue(parts[parts.length - 1])
            return
          }
        } else if (delimiter instanceof RegExp) {
          const match = newValue.match(delimiter)
          if (match) {
            const parts = newValue.split(delimiter)
            parts.slice(0, -1).forEach(part => addTag(part))
            setInputValue(parts[parts.length - 1])
            return
          }
        }
      }

      setInputValue(newValue)
    }

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && inputValue) {
        e.preventDefault()
        addTag(inputValue)
      } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        e.preventDefault()
        removeTag(tags.length - 1)
      } else if (e.key === 'Escape') {
        setInputValue('')
        inputRef.current?.blur()
      }
    }

    const handleContainerClick = () => {
      if (!disabled) {
        inputRef.current?.focus()
      }
    }

    const sizeConfig = sizeClasses[size]
    const isMaxTagsReached = maxTags !== undefined && tags.length >= maxTags

    return (
      <div
        ref={containerRef}
        data-slot="tags-input-wrapper"
        className={cn(
          'border-input bg-input/30 hover:bg-input/50 flex w-full flex-wrap items-center rounded-md border shadow-xs transition-[color,box-shadow] outline-none',
          sizeConfig.container,
          'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          disabled && 'pointer-events-none cursor-not-allowed opacity-50',
          className,
        )}
        onClick={handleContainerClick}
        {...props}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {tags.map((tag, index) => (
            <motion.div
              key={`${tag}-${index}`}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <Badge
                variant="neutral"
                size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md'}
                className={cn('group flex items-center gap-1 pr-1', sizeConfig.badge, tagClassName)}
              >
                <span className="truncate max-w-[200px]">{tag}</span>
                <button
                  type="button"
                  aria-label={`Remove ${tag}`}
                  className="hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full p-0.5 transition-colors duration-150"
                  onClick={e => {
                    e.stopPropagation()
                    removeTag(index)
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

        {!isMaxTagsReached && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder || t('placeholder')}
            disabled={disabled}
            data-slot="tags-input"
            className={cn(
              'placeholder:text-muted-foreground flex-1 bg-transparent px-1 text-base outline-none min-w-[120px]',
              sizeConfig.input,
              inputClassName,
            )}
          />
        )}
      </div>
    )
  },
)

TagsInput.displayName = 'TagsInput'

export { TagsInput }
export type { TagsInputProps, TagsInputSize }
