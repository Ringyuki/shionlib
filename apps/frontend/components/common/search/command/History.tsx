import { CommandGroup, CommandItem, CommandSeparator } from '@/components/shionui/Command'
import { TrashIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useSearchStore } from '@/store/searchStore'

interface HistoryProps {
  onSelect: (query: string) => void
}

export const History = ({ onSelect }: HistoryProps) => {
  const t = useTranslations('Components.Common.Search.Command.History')
  const { deleteAllHistory, history } = useSearchStore()

  const handleSelectItem = (query: string) => {
    onSelect(query)
  }
  return (
    history.length > 0 && (
      <>
        <CommandGroup
          heading={
            <span className="flex justify-between">
              <span>{t('history')}</span>
              <span
                className="text-destructive cursor-pointer hover:text-destructive/80 transition-colors flex items-center gap-1"
                onClick={() => deleteAllHistory()}
              >
                <TrashIcon className="size-3" />
                {t('delete_all')}
              </span>
            </span>
          }
          className="py-1! px-1!"
        >
          {history.map(item => (
            <CommandItem
              className="border border-transparent data-[selected=true]:border-primary/20"
              key={`${item.id}-${item.query}`}
              id={`${item.id}-${item.query}`}
              onSelect={() => handleSelectItem(item.query)}
            >
              {item.query}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator className="my-2" />
      </>
    )
  )
}
