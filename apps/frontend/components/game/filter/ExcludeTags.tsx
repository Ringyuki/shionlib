import {
  AsyncMultiSelect,
  AsyncMultiSelectContent,
  AsyncMultiSelectItem,
} from '@/components/shionui/AsyncMultiSelect'
import { shionlibRequest } from '@/utils/request'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { HashIcon } from 'lucide-react'

interface ExcludeTagsProps {
  onExcludeTagsChange: (tags: string[]) => void
  value?: string[]
}

interface TagSuggestion {
  name: string
  display_name?: string
  count: number
}

const getData = async (q: string) => {
  try {
    const data = await shionlibRequest().get<TagSuggestion[]>('/search/tags', {
      params: {
        q,
      },
    })
    return (data.data ?? []).map(t => t.display_name ?? t.name)
  } catch {
    return []
  }
}

export const ExcludeTags = ({ onExcludeTagsChange, value }: ExcludeTagsProps) => {
  const t = useTranslations('Components.Game.Filter.ExcludeTags')
  const [tags, setTags] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>(value ?? [])
  const [loading, setLoading] = useState(false)

  const handleSearch = async (query: string) => {
    setLoading(true)
    setTags(await getData(query))
    setLoading(false)
  }
  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags)
    onExcludeTagsChange(tags)
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="text-xs text-muted-foreground flex items-center gap-0.5">
        <HashIcon className="size-3.5" />
        {t('excludeTags')}
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
