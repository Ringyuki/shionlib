'use client'

import { Input } from '@/components/shionui/Input'
import { Button } from '@/components/shionui/Button'
import { Search, Plus } from 'lucide-react'
import { GameRelation, GameItem } from '@/interfaces/game/game.interface'
import { useTranslations } from 'next-intl'
import { shionlibRequest } from '@/utils/request'
import { useState } from 'react'
import { sileo } from 'sileo'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'
import { GameRelationType, GameRelationTypeOptions } from '@/interfaces/game/game.interface'

interface SearchRelationProps {
  relations: GameRelation[]
  onAdd: () => void
  game_id: number
}

export const SearchRelation = ({ relations, onAdd, game_id }: SearchRelationProps) => {
  const t = useTranslations('Components.Game.Edit.Relation')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<GameItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [selectedRelationType, setSelectedRelationType] = useState<GameRelationType>('SEQUEL')

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const res = await shionlibRequest().get<{ items: GameItem[] }>('/game/list', {
        params: { q: searchQuery, page: 1, pageSize: 10 },
      })
      setSearchResults(res.data?.items || [])
    } catch {
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAdd = async (toGameId: number) => {
    setAddLoading(true)
    try {
      await shionlibRequest().put(`/game/${game_id}/edit/relations`, {
        data: { relations: [{ to_game_id: toGameId, relation: selectedRelationType }] },
      })
      sileo.success({ title: t('Search.added') })
      setSearchResults([])
      setSearchQuery('')
      onAdd()
    } catch {
    } finally {
      setAddLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold">{t('Search.title')}</h3>
      <div className="flex flex-wrap gap-2">
        <Select
          value={selectedRelationType}
          onValueChange={v => setSelectedRelationType(v as GameRelationType)}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GameRelationTypeOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {t(`relationType.${o.value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('Search.placeholder')}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button
          onClick={handleSearch}
          loading={searchLoading}
          renderIcon={<Search className="size-4" />}
        >
          {t('Search.search')}
        </Button>
      </div>

      {searchResults.length > 0 && (
        <div className="space-y-2 mt-2">
          {searchResults.map(game => {
            const alreadyAdded =
              relations.some(r => r.to_game_id === game.id) || game.id === Number(game_id)
            const title = game.title_zh || game.title_jp || game.title_en
            return (
              <div
                key={game.id}
                className="flex items-center gap-3 p-2 rounded-md bg-muted/40 border border-border/50"
              >
                <span className="text-xs text-muted-foreground shrink-0">#{game.id}</span>
                <span className="font-medium flex-1 text-sm line-clamp-1">{title}</span>
                <Button
                  size="sm"
                  disabled={alreadyAdded}
                  onClick={() => handleAdd(game.id)}
                  loading={addLoading}
                  renderIcon={<Plus className="size-3.5" />}
                >
                  {alreadyAdded ? t('Search.already_added') : t('Search.add')}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
