'use client'

import { FormField, FormItem, FormControl, FormMessage } from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'
import { Button } from '@/components/shionui/Button'
import { Plus, Trash2 } from 'lucide-react'
import { useFieldArray, UseFormReturn, FieldValues, Path, ArrayPath } from 'react-hook-form'

export interface KeyValueField {
  fieldKey: string
  placeholder: string
}

interface KeyValueArrayInputProps<T extends FieldValues> {
  form: UseFormReturn<T>
  name: ArrayPath<T>
  fields: [KeyValueField, KeyValueField]
  addButtonText: string
  emptyItem: Record<string, string>
}

export function KeyValueArrayInput<T extends FieldValues>({
  form,
  name,
  fields: [field1, field2],
  addButtonText,
  emptyItem,
}: KeyValueArrayInputProps<T>) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name,
  })

  return (
    <div className="flex flex-col gap-2">
      {fields.map((_, index) => (
        <div key={index} className="flex gap-2 items-center">
          <FormField
            control={form.control}
            name={`${name}.${index}.${field1.fieldKey}` as Path<T>}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input {...field} placeholder={field1.placeholder} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`${name}.${index}.${field2.fieldKey}` as Path<T>}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormControl>
                  <Input {...field} placeholder={field2.placeholder} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="button"
            appearance="ghost"
            size="icon"
            intent="destructive"
            onClick={() => remove(index)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        appearance="outline"
        size="sm"
        onClick={() => append(emptyItem as any)}
        className="w-fit"
        renderIcon={<Plus className="size-4" />}
      >
        {addButtonText}
      </Button>
    </div>
  )
}
