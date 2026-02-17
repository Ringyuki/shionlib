import {
  AsyncMultiSelect,
  AsyncMultiSelectContent,
  AsyncMultiSelectItem,
} from '@/components/shionui/AsyncMultiSelect'
import { shionlibRequest } from '@/utils/request'
import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Hash } from 'lucide-react'

interface TagsProps {
  onTagsChange: (tags: string[]) => void
  value?: string[]
}

const getData = async (q: string) => {
  try {
    const data = await shionlibRequest().get<string[]>('/search/tags', {
      params: {
        q,
      },
    })
    return data.data!
  } catch {}
}

export const Tags = ({ onTagsChange, value }: TagsProps) => {
  const t = useTranslations('Components.Game.Filter.Tags')
  const [tags, setTags] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>(value ?? [])
  const [loading, setLoading] = useState(false)

  const handleSearch = async (query: string) => {
    setLoading(true)
    setTags((await getData(query)) ?? [])
    setLoading(false)
  }
  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags)
    onTagsChange(tags)
  }

  return (
    <div className="flex flex-col gap-2 max-w-full md:min-w-64">
      <div className="text-xs text-muted-foreground flex items-center gap-0.5">
        <Hash className="size-3.5" />
        {t('tags')}
      </div>
      <AsyncMultiSelect
        placeholder={t('searchPlaceholder')}
        onSearch={handleSearch}
        loading={loading}
        value={selectedTags}
        onValueChange={handleTagsChange}
        clearOnSelect
      >
        <AsyncMultiSelectContent>
          {tags.map(tag => (
            <AsyncMultiSelectItem key={tag} value={tag}>
              {tag}
            </AsyncMultiSelectItem>
          ))}
        </AsyncMultiSelectContent>
      </AsyncMultiSelect>
    </div>
  )
}
