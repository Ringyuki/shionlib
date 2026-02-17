'use client'

import * as React from 'react'
import { PlusIcon, XIcon, GripVerticalIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'

import { cn } from '@/utils/cn'
import { Button } from './Button'
import { Input } from './Input'
import { Card } from './Card'
import { Sortable, SortableContent, SortableItem, SortableItemHandle } from './Sortable'

export type FieldConfig<T = any> = {
  key: keyof T
  label: string
  placeholder?: string
  type?: 'text' | 'number' | 'email' | 'url'
  required?: boolean
  validate?: (value: any) => boolean | string
  render?: (value: any, onChange: (value: any) => void, item: T) => React.ReactNode
}

type JsonArrayInputProps<T extends Record<string, any>> = Omit<
  React.ComponentProps<'div'>,
  'onChange'
> & {
  value?: T[]
  defaultValue?: T[]
  onChange?: (items: T[]) => void
  fields: FieldConfig<T>[]
  emptyItem: T
  placeholder?: string
  disabled?: boolean
  maxItems?: number
  minItems?: number
  sortable?: boolean
  addButtonText?: string
  itemClassName?: string
  onItemAdd?: (item: T) => void
  onItemRemove?: (item: T, index: number) => void
}

type ItemWithId<T> = T & { __id: string }

function JsonArrayInput<T extends Record<string, any>>({
  className,
  value,
  defaultValue = [],
  onChange,
  fields,
  emptyItem,
  placeholder,
  disabled = false,
  maxItems,
  minItems = 0,
  sortable = false,
  addButtonText = 'Add Item',
  itemClassName,
  onItemAdd,
  onItemRemove,
  ...props
}: JsonArrayInputProps<T>) {
  const isControlled = value !== undefined
  const [internalItems, setInternalItems] = React.useState<T[]>(defaultValue)
  const items = isControlled ? value : internalItems

  // Maintain a stable list of IDs per item index to prevent re-mounting on value changes
  const idsRef = React.useRef<string[]>([])

  // Add unique IDs to items for sortable functionality
  const itemsWithIds = React.useMemo<ItemWithId<T>[]>(() => {
    // Ensure idsRef length matches items length
    const ids = idsRef.current
    if (ids.length < items.length) {
      const missing = items.length - ids.length
      for (let i = 0; i < missing; i++) {
        // Prefer crypto.randomUUID when available (runs on client)
        const newId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        ids.push(newId)
      }
    } else if (ids.length > items.length) {
      idsRef.current = ids.slice(0, items.length)
    }

    return items.map((item, index) => ({
      ...item,
      __id: idsRef.current[index],
    }))
  }, [items])

  const setItems = (newItems: T[] | ItemWithId<T>[]) => {
    // Remove __id from items before calling onChange
    const cleanItems = newItems.map(item => {
      if ('__id' in item) {
        const { __id, ...rest } = item as ItemWithId<T>
        return rest as unknown as T
      }
      return item as T
    })
    if (!isControlled) {
      setInternalItems(cleanItems)
    }
    onChange?.(cleanItems)
  }

  const addItem = () => {
    if (maxItems !== undefined && items.length >= maxItems) return

    const newItem = { ...emptyItem }
    // Append a stable id for the new item
    idsRef.current.push(
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    )
    const newItems = [...items, newItem]
    setItems(newItems)
    onItemAdd?.(newItem)
  }

  const removeItem = (id: string) => {
    const index = itemsWithIds.findIndex(item => item.__id === id)
    if (index === -1 || items.length <= minItems) return

    const removedItem = items[index]
    // Remove the corresponding id to keep ids and items aligned
    idsRef.current.splice(index, 1)
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    onItemRemove?.(removedItem, index)
  }

  const updateItem = (id: string, key: keyof T, newValue: any) => {
    const index = itemsWithIds.findIndex(item => item.__id === id)
    if (index === -1) return

    const newItems = [...items]
    newItems[index] = { ...newItems[index], [key]: newValue }
    setItems(newItems)
  }

  const isMaxItemsReached = maxItems !== undefined && items.length >= maxItems
  const isMinItemsReached = items.length <= minItems

  const handleSortableChange = (newItems: ItemWithId<T>[]) => {
    // Reorder ids according to newItems order to keep them stable
    idsRef.current = newItems.map(item => item.__id)
    setItems(newItems)
  }

  const renderItemContent = (item: ItemWithId<T>) => {
    return (
      <Card
        className={cn(
          'group relative border-input hover:border-ring/50 p-4 transition-colors',
          itemClassName,
        )}
      >
        <div className="flex items-start gap-3">
          {sortable && (
            <SortableItemHandle className="pt-2">
              <GripVerticalIcon className="text-muted-foreground size-4" />
            </SortableItemHandle>
          )}

          <div className="flex-1 space-y-3">
            {fields.map(field => (
              <div key={String(field.key)} className="space-y-1.5 flex flex-col gap-0.5">
                <label className="text-foreground text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </label>
                {field.render ? (
                  field.render(
                    item[field.key],
                    newValue => updateItem(item.__id, field.key, newValue),
                    item,
                  )
                ) : (
                  <Input
                    type={field.type || 'text'}
                    value={String(item[field.key] ?? '')}
                    onChange={e => updateItem(item.__id, field.key, e.target.value)}
                    placeholder={field.placeholder}
                    disabled={disabled}
                    size="sm"
                  />
                )}
              </div>
            ))}
          </div>

          {!isMinItemsReached && (
            <Button
              type="button"
              intent="destructive"
              appearance="ghost"
              size="icon"
              className="opacity-100 md:opacity-0 md:group-hover:opacity-100 size-4 shrink-0 mt-1"
              onClick={() => removeItem(item.__id)}
              disabled={disabled}
              aria-label="Remove item"
              renderIcon={() => <XIcon />}
            />
          )}
        </div>
      </Card>
    )
  }

  return (
    <div
      data-slot="json-array-input-wrapper"
      className={cn('flex flex-col gap-3', className)}
      {...props}
    >
      {sortable ? (
        <>
          {/* @ts-expect-error - Sortable generic type inference issue with ItemWithId wrapper */}
          <Sortable
            value={itemsWithIds}
            onValueChange={handleSortableChange}
            getItemValue={(item: ItemWithId<T>) => item.__id}
            orientation="vertical"
          >
            {itemsWithIds.length > 0 && (
              <SortableContent className="flex flex-col gap-3">
                <AnimatePresence initial={false}>
                  {itemsWithIds.map(item => (
                    <SortableItem key={item.__id} value={item.__id} asChild>
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                      >
                        {renderItemContent(item)}
                      </motion.div>
                    </SortableItem>
                  ))}
                </AnimatePresence>
              </SortableContent>
            )}
          </Sortable>
        </>
      ) : (
        itemsWithIds.length > 0 && (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {itemsWithIds.map(item => (
                <motion.div
                  key={item.__id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  {renderItemContent(item)}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )
      )}

      {!isMaxItemsReached && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          <Button
            type="button"
            intent="neutral"
            appearance="outline"
            className="w-full"
            onClick={addItem}
            disabled={disabled}
            renderIcon={() => <PlusIcon />}
          >
            {addButtonText}
          </Button>
        </motion.div>
      )}
    </div>
  )
}

JsonArrayInput.displayName = 'JsonArrayInput'

export { JsonArrayInput }
export type { JsonArrayInputProps }
