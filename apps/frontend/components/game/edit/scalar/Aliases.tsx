import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { TagsInput } from '@/components/shionui/TagsInput'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import type { ReactNode } from 'react'

interface AliasesProps {
  form: UseFormReturn<GameScalar>
  syncAction?: ReactNode
}

export const Aliases = ({ form, syncAction }: AliasesProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  return (
    <FormField
      control={form.control}
      name="aliases"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('aliases')}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <TagsInput {...field} className="min-w-0 flex-1" />
              {syncAction && <div className="shrink-0">{syncAction}</div>}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
