import { useTranslations } from 'next-intl'
import { Textarea } from '@/components/shionui/Textarea'
import { FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { ChangeEvent } from 'react'

interface EditNoteProps {
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
}

export const EditNote = ({ onChange }: EditNoteProps) => {
  const t = useTranslations('Components.Game.Edit.EditNote')
  return (
    <FormItem>
      <FormLabel>{t('title')}</FormLabel>
      <FormControl>
        <Textarea onChange={onChange} placeholder={t('placeholder')} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}
