'use client'

import { Card, CardContent } from '@/components/shionui/Card'
import { useState } from 'react'
import { Tags } from './Tags'
import { DateFilter } from './Date'
import { Sort } from './Sort'
import { SortBy, SortOrder } from './enums/Sort.enum'
import qs from 'qs'
import { useRouter } from '@/i18n/navigation.client'
import { useEffect, useRef } from 'react'

interface GameFilterProps {
  initialTags: string[]
  initialYear: number[]
  initialMonth: number[]
  initialSortBy: SortBy
  initialSortOrder: SortOrder
}

export const GameFilter = ({
  initialTags,
  initialYear,
  initialMonth,
  initialSortBy,
  initialSortOrder,
}: GameFilterProps) => {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [year, setYear] = useState<number[]>(initialYear)
  const [month, setMonth] = useState<number[]>(initialMonth)
  const [sortBy, setSortBy] = useState<SortBy>(initialSortBy)
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder)

  const router = useRouter()
  const init = useRef(true)

  const buildHref = (
    _tags: string[],
    _years: number[],
    _months: number[],
    _sortBy: SortBy,
    _sortOrder: SortOrder,
  ) => {
    const query = {
      filter: {
        tags: _tags,
        years: _years,
        months: _months,
        sort_by: _sortBy,
        sort_order: _sortOrder,
      },
    }
    const queryString = qs.stringify(query, { arrayFormat: 'brackets' })
    router.push(`/game?${queryString}`)
  }

  useEffect(() => {
    if (init.current) return
    buildHref(tags, year, month, sortBy, sortOrder)
  }, [tags, year, month, sortBy, sortOrder])
  useEffect(() => {
    setTimeout(() => {
      init.current = false
    }, 100)
  }, [])

  return (
    <Card className="py-0 w-full">
      <CardContent className="p-2 w-full flex flex-wrap flex-col md:flex-row gap-4 md:gap-2">
        <Tags onTagsChange={setTags} value={tags} />
        <DateFilter
          onYearChange={setYear}
          onMonthChange={setMonth}
          yearValue={year}
          monthValue={month}
        />
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
