'use client'

import { StatsCard } from './StatsCard'
import { StatsOverview } from '@/interfaces/admin/stats.interface'
import { Skeleton } from '@/components/shionui/Skeleton'
import {
  Gamepad2,
  Users,
  Download,
  Eye,
  UserPlus,
  MessageSquare,
  Building2,
  PersonStanding,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

interface StatsCardGridProps {
  data?: StatsOverview
  isLoading?: boolean
}

const statsConfig = (t: any) => {
  return [
    {
      key: 'totalGames',
      title: t('totalGames'),
      icon: Gamepad2,
      colorScheme: 'blue' as const,
    },
    {
      key: 'totalUsers',
      title: t('totalUsers'),
      icon: Users,
      colorScheme: 'green' as const,
    },
    {
      key: 'totalDownloads',
      title: t('totalDownloads'),
      icon: Download,
      colorScheme: 'purple' as const,
    },
    {
      key: 'totalViews',
      title: t('totalViews'),
      icon: Eye,
      colorScheme: 'orange' as const,
    },
    {
      key: 'totalCharacters',
      title: t('totalCharacters'),
      icon: PersonStanding,
      colorScheme: 'pink' as const,
    },
    {
      key: 'totalDevelopers',
      title: t('totalDevelopers'),
      icon: Building2,
      colorScheme: 'blue' as const,
    },
    {
      key: 'totalComments',
      title: t('totalComments'),
      icon: MessageSquare,
      colorScheme: 'green' as const,
    },
    {
      key: 'newUsersToday',
      title: t('newUsersToday'),
      icon: UserPlus,
      colorScheme: 'purple' as const,
    },
  ] as const
}

export function StatsCardGrid({ data, isLoading }: StatsCardGridProps) {
  const t = useTranslations('Admin.Dashboard')
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-xl" />
        ))}
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statsConfig(t).map(config => (
        <StatsCard
          key={config.key}
          title={config.title}
          value={data[config.key as keyof StatsOverview]}
          icon={config.icon}
          colorScheme={config.colorScheme}
          className="animate-in fade-in"
        />
      ))}
    </div>
  )
}
