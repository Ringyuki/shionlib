import { SearchTrendingItem } from '@/interfaces/search/search.interface'
import { CommandGroup, CommandItem } from '@/components/shionui/Command'
import { useTranslations } from 'next-intl'
import { shionlibRequest } from '@/utils/request'
import { useEffect } from 'react'
import { useSearchStore } from '@/store/searchStore'

interface TrendingProps {
  onSelect: (query: string) => void
}

export const Trending = ({ onSelect }: TrendingProps) => {
  const t = useTranslations('Components.Common.Search.Command.Trending')
  const { trending, setTrending } = useSearchStore()
  const handleSelectItem = (query: string) => {
    onSelect(query)
  }

  const getTrending = async () => {
    const data = await shionlibRequest().get<SearchTrendingItem[]>('/search/trending')
    setTrending({ trending: data.data!, updated_at: new Date().toISOString() })
  }
  useEffect(() => {
    if (!trending.trending?.length) getTrending()
    if (
      trending.updated_at &&
      new Date().getTime() - new Date(trending.updated_at).getTime() > 1000 * 60 * 60
    )
      getTrending()
  }, [])
  return (
    trending.trending?.length > 0 && (
      <CommandGroup heading={t('trending')} className="py-1! px-1! pb-0!">
        {trending.trending.map(item => (
          <CommandItem
            className="border border-transparent data-[selected=true]:border-primary/20"
            key={item.query}
            id={item.query}
            onSelect={() => handleSelectItem(item.query)}
          >
            {item.query}
          </CommandItem>
        ))}
      </CommandGroup>
    )
  )
}
