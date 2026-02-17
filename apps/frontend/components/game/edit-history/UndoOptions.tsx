import { useForm } from 'react-hook-form'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/shionui/Form'
import { Switch } from '@/components/shionui/animated/Switch'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/shionui/Select'
import { useTranslations } from 'next-intl'

export interface UndoOption {
  force: boolean
  mode: 'strict' | 'cascade'
}
export interface UndoOptionsProps {
  onUndoOptionChange: (undoOption: UndoOption) => void
}

export const UndoOptionComponent = ({ onUndoOptionChange }: UndoOptionsProps) => {
  const t = useTranslations('Components.Game.EditHistory.UndoOptions')
  const form = useForm<UndoOption>({
    defaultValues: {
      force: false,
      mode: 'strict',
    },
  })
  return (
    <Form {...form}>
      <form onChange={() => onUndoOptionChange(form.getValues())} className="space-y-4">
        <FormField
          control={form.control}
          name="force"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('force')}</FormLabel>
              <FormControl>
                <Switch id="force" checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('mode')}</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('mode')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">{t('strict')}</SelectItem>
                    <SelectItem value="cascade">{t('cascade')}</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}
