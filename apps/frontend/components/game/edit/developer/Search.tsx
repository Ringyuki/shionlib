import { Input } from '@/components/shionui/Input'
import { Button } from '@/components/shionui/Button'
import { Search, Plus } from 'lucide-react'
import { DeveloperRelation } from '@/interfaces/game/game.interface'
import { useTranslations } from 'next-intl'
import { DeveloperSearchResult } from '@/interfaces/developer/developer.interface'
import { shionlibRequest } from '@/utils/request'
import { useState } from 'react'

interface SearchDeveloperProps {
  relations: DeveloperRelation[]
  onAdd: (developerId: number, role?: string) => void
  game_id: number
}

export const SearchDeveloper = ({ relations, onAdd, game_id }: SearchDeveloperProps) => {
  const t = useTranslations('Components.Game.Edit.Developer.Search')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<DeveloperSearchResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [addLoading, setAddloading] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const res = await shionlibRequest().get<{ items: DeveloperSearchResult[] }>(
        `/developer/list`,
        { params: { q: searchQuery, page: 1, pageSize: 10 } },
      )
      setSearchResults(res.data?.items || [])
    } catch {
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAdd = async (developerId: number, role?: string) => {
    setAddloading(true)
    try {
      await shionlibRequest().put(`/game/${game_id}/edit/developers`, {
        data: { developers: [{ developer_id: developerId, role: role || null }] },
      })
      onAdd(developerId, role)
      setSearchResults([])
      setSearchQuery('')
    } catch {
    } finally {
      setAddloading(false)
    }
  }
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">{t('title')}</h3>
      <div className="flex gap-2">
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('placeholder')}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
        />
        <Button
          onClick={handleSearch}
          loading={searchLoading}
          renderIcon={<Search className="size-4" />}
        >
          {t('search')}
        </Button>
      </div>
      {searchResults.length > 0 && (
        <div className="space-y-2 mt-2">
          {searchResults.map(dev => {
            const alreadyAdded = relations.some(r => r.developer_id === dev.id)
            return (
              <div key={dev.id} className="flex items-center gap-4 bg-background-soft rounded-md">
                <span className="font-medium flex-1">{dev.name}</span>
                {dev.aliases.length > 0 && (
                  <span className="text-muted-foreground text-sm">
                    {dev.aliases.slice(0, 2).join(', ')}
                  </span>
                )}
                <Button
                  disabled={alreadyAdded}
                  onClick={() => handleAdd(dev.id)}
                  renderIcon={<Plus className="size-4" />}
                  loading={addLoading}
                >
                  {alreadyAdded ? t('already_added') : t('add')}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
