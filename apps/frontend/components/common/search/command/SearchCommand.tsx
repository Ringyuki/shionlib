'use client'

import { Command, CommandInput, CommandList } from '@/components/shionui/Command'
import { useTranslations } from 'next-intl'
import { ScrollArea } from '@/components/shionui/ScrollArea'
import { Kbd } from '@/components/shionui/Kbd'
import { CornerDownLeft } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from '@/i18n/navigation.client'
import { useSearchStore } from '@/store/searchStore'
import { History } from './History'
import { Trending } from './Trending'
import { Suggest } from './Suggest'

export const SearchCommand = () => {
  const t = useTranslations('Components.Common.Search.Command.SearchCommand')
  const { addHistory, closeSearchDialog } = useSearchStore()

  const router = useRouter()
  const [q, setQ] = useState('')
  const handleSelectItem = (query: string) => {
    setQ(query)
    handleSearch(query)
  }
  const handleSearch = (_q?: string) => {
    const query = (_q || q).trim()
    if (query) {
      router.push(`/search/game?q=${query}`)
      closeSearchDialog()
      addHistory({
        id: Date.now(),
        query,
        created_at: new Date().toISOString(),
      })
    }
  }
  return (
    <Command>
      <div className="border-4 rounded-xl">
        <CommandInput
          className="border-none bg-secondary rounded-lg mt-1 ml-1 mr-1"
          placeholder={t('placeholder')}
          onValueChange={setQ}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              handleSearch()
            }
          }}
        />
        <CommandList className="max-h-[400px] mt-2 my-1">
          <ScrollArea className="h-[400px]" showScrollHint={false}>
            {q ? (
              <Suggest q={q} onSelect={handleSelectItem} />
            ) : (
              <>
                <History onSelect={handleSelectItem} />
                <Trending onSelect={handleSelectItem} />
              </>
            )}
          </ScrollArea>
        </CommandList>
        <div className="bg-secondary rounded-b-lg flex items-center gap-1 py-2 px-1 text-xs text-muted-foreground">
          <Kbd>
            <CornerDownLeft />
          </Kbd>
          <span>{t('press_enter_to_search')}</span>
        </div>
      </div>
    </Command>
  )
}
