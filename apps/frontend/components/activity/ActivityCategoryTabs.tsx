'use client'

import { useTranslations } from 'next-intl'
import { Tabs, TabsList, TabsTrigger } from '@/components/shionui/animated/Tabs'
import {
  activityFeedCategories,
  type ActivityFeedCategory,
} from './activities/constants/activity-feed'
import { activityCategoryIconMap } from './constants/activity-page'

interface ActivityCategoryTabsProps {
  activeCategory: ActivityFeedCategory
  onChange: (category: ActivityFeedCategory) => void
}

export const ActivityCategoryTabs = ({ activeCategory, onChange }: ActivityCategoryTabsProps) => {
  const t = useTranslations('Components.Home.Activity')

  return (
    <Tabs value={activeCategory} onValueChange={value => onChange(value as ActivityFeedCategory)}>
      <TabsList variant="underlined" scrollAreaClassName="bg-transparent">
        {activityFeedCategories.map(category => {
          const Icon = activityCategoryIconMap[category.value]
          return (
            <TabsTrigger key={category.value} value={category.value} className="gap-2 px-3">
              <Icon className="size-4" />
              {t(`Categories.${category.value}`)}
            </TabsTrigger>
          )
        })}
      </TabsList>
    </Tabs>
  )
}
