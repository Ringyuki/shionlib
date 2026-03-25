'use client'

import { useMemo } from 'react'
import { useTheme } from 'next-themes'
import type { PartialTheme } from '@nivo/theming'

export const useNivoTheme = (): PartialTheme => {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return useMemo(
    () => ({
      text: { fill: isDark ? '#d1d5db' : '#374151' },
      axis: {
        ticks: {
          text: { fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 11 },
          line: { stroke: isDark ? '#374151' : '#e5e7eb' },
        },
        legend: { text: { fill: isDark ? '#d1d5db' : '#374151', fontSize: 12 } },
      },
      grid: { line: { stroke: isDark ? '#1f2937' : '#f3f4f6' } },
      tooltip: {
        container: {
          background: isDark ? '#1f2937' : '#ffffff',
          color: isDark ? '#f3f4f6' : '#111827',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          fontSize: 12,
        },
      },
      crosshair: { line: { stroke: isDark ? '#6b7280' : '#9ca3af', strokeWidth: 1 } },
    }),
    [isDark],
  )
}
