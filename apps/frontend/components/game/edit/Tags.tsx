'use client'

import {
  AsyncMultiSelect,
  AsyncMultiSelectContent,
  AsyncMultiSelectItem,
} from '@/components/shionui/AsyncMultiSelect'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { shionlibRequest } from '@/utils/request'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { GameTagRelation, GameTag } from '@/interfaces/game/game.interface'
import { useState } from 'react'
import type { ReactNode } from 'react'

interface TagsProps {
  form: UseFormReturn<GameScalar>
  syncAction?: ReactNode
}
interface Tag extends Pick<GameTag, 'id' | 'name'> {
  display_name?: string
}
interface TagRelation extends Omit<GameTagRelation, 'tag'> {
  tag: Tag
}

const fetchTagSuggestions = async (q: string): Promise<Tag[]> => {
  try {
    const { data } = await shionlibRequest().get<Tag[]>('/search/tags', { params: { q } })
    return data ?? []
  } catch {
    return []
  }
}

const normalize = (s: string) => s.toLowerCase().trim()
const displayName = (tag: Tag) => tag.display_name ?? tag.name

export const Tags = ({ form, syncAction }: TagsProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  const [suggestions, setSuggestions] = useState<Tag[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (!q) {
      setSuggestions([])
      return
    }
    setLoading(true)
    setSuggestions(await fetchTagSuggestions(q))
    setLoading(false)
  }

  return (
    <FormField
      control={form.control}
      name="tags"
      render={({ field }) => {
        const selected: TagRelation[] = field.value ?? []
        // Display names for badges; deduplication is done by comparing normalized forms
        const selectedDisplay = selected.map(r => r.tag_alias ?? r.tag.name)
        const normalizedSelected = selectedDisplay.map(normalize)
        const trimmed = query.trim()
        const normalizedTrimmed = normalize(trimmed)

        const suggestionNames = suggestions.map(s => normalize(displayName(s)))
        const filteredSuggestions = suggestions.filter(
          s => !normalizedSelected.includes(normalize(displayName(s))),
        )
        const showCreate =
          trimmed !== '' &&
          !normalizedSelected.includes(normalizedTrimmed) &&
          !suggestionNames.includes(normalizedTrimmed) &&
          !loading

        // onValueChange receives either canonical names (from suggestions) or the
        // raw typed value (from the create item, which uses trimmed as its value).
        // We normalize each entry and build GameTagRelation objects, deduplicating
        // by canonical name and preserving existing alias data.
        const suggestionByIdEntries: Array<[string, number]> = suggestions.flatMap(s => [
          [normalize(s.name), s.id],
          [normalize(displayName(s)), s.id],
        ])
        const suggestionById = new Map(suggestionByIdEntries)
        const handleChange = (names: string[]) => {
          const existingByCanonical = new Map(selected.map(r => [r.tag.name, r]))
          const seen = new Set<string>()
          const updated: TagRelation[] = []
          for (const name of names) {
            const canonical = normalize(name)
            const display = name.trim()
            if (seen.has(canonical)) continue
            seen.add(canonical)
            const existing = existingByCanonical.get(canonical)
            if (existing) {
              updated.push(existing)
            } else {
              const id = suggestionById.get(canonical) ?? 0
              updated.push({
                tag_alias: display !== canonical ? display : null,
                tag: { id, name: canonical },
              })
            }
          }
          field.onChange(updated)
        }

        return (
          <FormItem>
            <FormLabel>{t('tags')}</FormLabel>
            <FormControl>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <AsyncMultiSelect
                    value={selectedDisplay}
                    onValueChange={handleChange}
                    onSearch={handleSearch}
                    loading={loading}
                    clearOnSelect
                    triggerClassName="w-full"
                  >
                    <AsyncMultiSelectContent>
                      {filteredSuggestions.map(s => (
                        <AsyncMultiSelectItem
                          key={`${s.id}:${displayName(s)}`}
                          value={displayName(s)}
                        >
                          {displayName(s)}
                        </AsyncMultiSelectItem>
                      ))}
                      {showCreate && (
                        <AsyncMultiSelectItem value={trimmed}>
                          {t('createTag', { tag: trimmed })}
                        </AsyncMultiSelectItem>
                      )}
                    </AsyncMultiSelectContent>
                  </AsyncMultiSelect>
                </div>
                {syncAction && <div className="shrink-0">{syncAction}</div>}
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
