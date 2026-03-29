'use client'

import { Card, CardContent } from '@/components/shionui/Card'
import { useState } from 'react'
import { Tags } from './Tags'
import { ExcludeTags } from './ExcludeTags'
import { DateFilter } from './Date'
import { PlatformFilter } from './Platform'
import { Sort } from './Sort'
import { SortBy, SortOrder } from './enums/Sort.enum'
import qs from 'qs'
import { useRouter } from '@/i18n/navigation.client'
import { useEffect, useRef } from 'react'

interface GameFilterProps {
  initialTags: string[]
  initialExcludeTags: string[]
  initialYear: number[]
  initialMonth: number[]
  initialPlatforms: string[]
  initialSortBy: SortBy
  initialSortOrder: SortOrder
}

export const GameFilter = ({
  initialTags,
  initialExcludeTags,
  initialYear,
  initialMonth,
  initialPlatforms,
  initialSortBy,
  initialSortOrder,
}: GameFilterProps) => {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [excludeTags, setExcludeTags] = useState<string[]>(initialExcludeTags)
  const [year, setYear] = useState<number[]>(initialYear)
  const [month, setMonth] = useState<number[]>(initialMonth)
  const [platforms, setPlatforms] = useState<string[]>(initialPlatforms)
  const [sortBy, setSortBy] = useState<SortBy>(initialSortBy)
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder)

  const router = useRouter()
  const init = useRef(true)

  const buildHref = (
    _tags: string[],
    _excludeTags: string[],
    _years: number[],
    _months: number[],
    _platforms: string[],
    _sortBy: SortBy,
    _sortOrder: SortOrder,
  ) => {
    const query = {
      filter: {
        tags: _tags,
        exclude_tags: _excludeTags,
        years: _years,
        months: _months,
        platforms: _platforms,
        sort_by: _sortBy,
        sort_order: _sortOrder,
      },
    }
    const queryString = qs.stringify(query, { arrayFormat: 'brackets' })
    router.push(`/game?${queryString}`)
  }

  useEffect(() => {
    if (init.current) return
    buildHref(tags, excludeTags, year, month, platforms, sortBy, sortOrder)
  }, [tags, excludeTags, year, month, platforms, sortBy, sortOrder])
  useEffect(() => {
    setTimeout(() => {
      init.current = false
    }, 100)
  }, [])

  return (
    <Card className="py-0 w-full">
      <CardContent className="p-2 w-full flex flex-wrap flex-col md:flex-row gap-4 md:gap-2">
        <Tags onTagsChange={setTags} value={tags} />
        <ExcludeTags onExcludeTagsChange={setExcludeTags} value={excludeTags} />
        <DateFilter
          onYearChange={setYear}
          onMonthChange={setMonth}
          yearValue={year}
          monthValue={month}
        />
        <PlatformFilter onPlatformChange={setPlatforms} value={platforms} />
        <Sort
          onSortByChange={setSortBy}
          onSortOrderChange={setSortOrder}
          sortByValue={sortBy}
          sortOrderValue={sortOrder}
        />
      </CardContent>
    </Card>
  )
}
