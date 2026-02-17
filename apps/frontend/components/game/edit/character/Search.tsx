import { Input } from '@/components/shionui/Input'
import { Button } from '@/components/shionui/Button'
import { Search, Plus } from 'lucide-react'
import { GameCharacterRelation } from '@/interfaces/game/game.interface'
import { useTranslations } from 'next-intl'
import { shionlibRequest } from '@/utils/request'
import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'

interface CharacterSearchResult {
  id: number
  name_jp: string
  name_zh?: string
  name_en?: string
  image?: string
  aliases?: string[]
}

interface SearchCharacterProps {
  relations: GameCharacterRelation[]
  onAdd: (characterId: number, role?: string) => void
  game_id: number
}

const ROLE_OPTIONS = ['main', 'primary', 'side', 'appears'] as const

export const SearchCharacter = ({ relations, onAdd, game_id }: SearchCharacterProps) => {
  const t = useTranslations('Components.Game.Edit.Character.Search')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<CharacterSearchResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<Record<number, string>>({})

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    try {
      const res = await shionlibRequest().get<{ items: CharacterSearchResult[] }>(
        `/character/list`,
        { params: { q: searchQuery, page: 1, pageSize: 10 } },
      )
      setSearchResults(res.data?.items || [])
    } catch {
    } finally {
      setSearchLoading(false)
    }
  }

  const handleAdd = async (characterId: number) => {
    const role = selectedRoles[characterId]
    setAddLoading(true)
    try {
      await shionlibRequest().put(`/game/${game_id}/edit/characters`, {
        data: { characters: [{ character_id: characterId, role: role || null }] },
      })
      onAdd(characterId, role)
      setSearchResults([])
      setSearchQuery('')
    } catch {
    } finally {
      setAddLoading(false)
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
          {searchResults.map(char => {
            const alreadyAdded = relations.some(r => r.character_id === char.id)
            const displayName = char.name_jp || char.name_zh || char.name_en || 'Unknown'
            return (
              <div key={char.id} className="flex items-center gap-4 bg-background-soft rounded-md">
                <span className="font-medium flex-1">{displayName}</span>
                {char.aliases && char.aliases.length > 0 && (
                  <span className="text-muted-foreground text-sm">
                    {char.aliases.slice(0, 2).join(', ')}
                  </span>
                )}
                <Select
                  value={selectedRoles[char.id] || ''}
                  onValueChange={v => setSelectedRoles({ ...selectedRoles, [char.id]: v })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder={t('role_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(role => (
                      <SelectItem key={role} value={role}>
                        {t(`role_${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={alreadyAdded}
                  onClick={() => handleAdd(char.id)}
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
