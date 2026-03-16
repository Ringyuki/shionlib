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

interface TagsProps {
  form: UseFormReturn<GameScalar>
}
interface Tag extends Pick<GameTag, 'id' | 'name'> {}
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

export const Tags = ({ form }: TagsProps) => {
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

        const suggestionNames = suggestions.map(s => s.name)
        const filteredSuggestions = suggestions.filter(
          s => !normalizedSelected.includes(normalize(s.name)),
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
        const suggestionById = new Map(suggestions.map(s => [s.name, s.id]))
        const handleChange = (names: string[]) => {
          const existingByCanonical = new Map(selected.map(r => [r.tag.name, r]))
          const seen = new Set<string>()
          const updated: TagRelation[] = []
          for (const name of names) {
            const canonical = normalize(name)
            if (seen.has(canonical)) continue
            seen.add(canonical)
            const existing = existingByCanonical.get(canonical)
            if (existing) {
              updated.push(existing)
            } else {
              const id = suggestionById.get(canonical) ?? 0
              updated.push({ tag: { id, name: canonical } })
            }
          }
          field.onChange(updated)
        }

        return (
          <FormItem>
            <FormLabel>{t('tags')}</FormLabel>
            <FormControl>
              <AsyncMultiSelect
                value={selectedDisplay}
                onValueChange={handleChange}
                onSearch={handleSearch}
                loading={loading}
                clearOnSelect
              >
                <AsyncMultiSelectContent>
                  {filteredSuggestions.map(s => (
                    <AsyncMultiSelectItem key={s.id} value={s.name}>
                      {s.name}
                    </AsyncMultiSelectItem>
                  ))}
                  {showCreate && (
                    <AsyncMultiSelectItem value={trimmed}>
                      {t('createTag', { tag: trimmed })}
                    </AsyncMultiSelectItem>
                  )}
                </AsyncMultiSelectContent>
              </AsyncMultiSelect>
            </FormControl>
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
