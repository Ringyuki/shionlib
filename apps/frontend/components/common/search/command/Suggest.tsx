import { SearchSuggestItem } from '@/interfaces/search/search.interface'
import { CommandGroup, CommandItem } from '@/components/shionui/Command'
import { useTranslations } from 'next-intl'
import { shionlibRequest } from '@/utils/request'
import { useState, useMemo } from 'react'
import { useDebounce } from 'react-use'

interface SuggestProps {
  q: string
  onSelect: (query: string) => void
}

export const Suggest = ({ q, onSelect }: SuggestProps) => {
  const t = useTranslations('Components.Common.Search.Command.Suggest')
  const [suggestions, setSuggestions] = useState<SearchSuggestItem[]>([])
  const trimmedQuery = q.trim()

  const shouldShowDirectSearchItem = useMemo(
    () => trimmedQuery.length > 0 && !suggestions.find(item => item.query === trimmedQuery),
    [trimmedQuery, suggestions],
  )

  const getSuggestions = async (q: string) => {
    const data = await shionlibRequest().get<SearchSuggestItem[]>(`/search/suggest`, {
      params: { prefix: q },
    })
    setSuggestions(data.data!)
  }

  useDebounce(
    () => {
      if (!trimmedQuery) {
        setSuggestions([])
        return
      }
      getSuggestions(q)
    },
    100,
    [q],
  )

  return (
    <CommandGroup heading={t('suggest')} className="py-1! px-1! pb-0!" forceMount>
      {shouldShowDirectSearchItem && (
        <CommandItem
          className="border border-transparent data-[selected=true]:border-primary/20"
          key="__direct-search__"
          value={trimmedQuery}
          onSelect={() => onSelect(trimmedQuery)}
        >
          {t('search_directly', { query: trimmedQuery })}
        </CommandItem>
      )}
      {suggestions.map(item => (
        <CommandItem
          className="border border-transparent data-[selected=true]:border-primary/20"
          key={item.query}
          id={item.query}
          onSelect={() => onSelect(item.query)}
        >
          {item.query}
        </CommandItem>
      ))}
    </CommandGroup>
  )
}
