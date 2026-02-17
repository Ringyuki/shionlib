'use client'

import { cn } from '@/utils/cn'
import { motion } from 'motion/react'
import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  description?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  colorScheme?: 'blue' | 'green' | 'purple' | 'orange' | 'pink'
  className?: string
}

const colorSchemes = {
  blue: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    icon: 'text-blue-500',
    border: 'border-blue-500/20',
  },
  green: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    icon: 'text-emerald-500',
    border: 'border-emerald-500/20',
  },
  purple: {
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    icon: 'text-purple-500',
    border: 'border-purple-500/20',
  },
  orange: {
    bg: 'bg-orange-500/10 dark:bg-orange-500/20',
    icon: 'text-orange-500',
    border: 'border-orange-500/20',
  },
  pink: {
    bg: 'bg-pink-500/10 dark:bg-pink-500/20',
    icon: 'text-pink-500',
    border: 'border-pink-500/20',
  },
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  colorScheme = 'blue',
  className,
}: StatsCardProps) {
  const colors = colorSchemes[colorScheme]

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-xl border p-6',
        'bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm',
        'border-gray-200 dark:border-gray-800',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
          {trend && (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  'text-sm font-medium',
                  trend.isPositive ? 'text-emerald-500' : 'text-red-500',
                )}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">vs last period</span>
            </div>
          )}
        </div>
        <div className={cn('rounded-xl p-3', colors.bg)}>
          <Icon className={cn('h-6 w-6', colors.icon)} />
        </div>
      </div>

      {/* Decorative gradient */}
      <div
        className={cn(
          'absolute -bottom-10 -right-10 h-32 w-32 rounded-full opacity-20 blur-2xl',
          colors.bg,
        )}
      />
    </motion.div>
  )
}
