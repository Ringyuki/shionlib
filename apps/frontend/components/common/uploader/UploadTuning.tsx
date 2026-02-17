'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'

import { cn } from '@/utils/cn'
import { Label } from '@/components/shionui/Label'
import { Slider } from '@/components/shionui/Silder'

const MB = 1024 * 1024
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

interface UploadTuningProps {
  className?: string
  concurrency: number
  desiredChunkSize: number
  minConcurrency?: number
  maxConcurrency?: number
  minChunkSize?: number
  maxChunkSize?: number
  onConcurrencyChange: (value: number) => void
  onDesiredChunkSizeChange: (value: number) => void
  disabled?: boolean
}

export const UploadTuning = ({
  className,
  concurrency,
  desiredChunkSize,
  minConcurrency = 1,
  maxConcurrency = 8,
  minChunkSize = 1024 * 1024,
  maxChunkSize = 1024 * 1024 * 32,
  onConcurrencyChange,
  onDesiredChunkSizeChange,
  disabled = false,
}: UploadTuningProps) => {
  const t = useTranslations('Components.Common.Uploader.UploadTuning')
  const fieldId = React.useId()
  const concurrencyId = `${fieldId}-concurrency`
  const chunkSizeId = `${fieldId}-chunk`

  const chunkSizeMb = Math.round(desiredChunkSize / MB)
  const chunkMinMb = Math.max(1, Math.round(minChunkSize / MB))
  const chunkMaxMb = Math.max(chunkMinMb, Math.round(maxChunkSize / MB))

  const handleConcurrencySliderChange = (values: number[]) => {
    if (disabled) return
    const value = values[0]
    const clamped = clamp(Math.round(value ?? minConcurrency), minConcurrency, maxConcurrency)
    onConcurrencyChange(clamped)
  }

  const handleChunkSizeSliderChange = (values: number[]) => {
    if (disabled) return
    const value = values[0]
    const clampedMb = clamp(Math.round(value ?? chunkMinMb), chunkMinMb, chunkMaxMb)
    onDesiredChunkSizeChange(clampedMb * MB)
  }

  return (
    <div
      data-disabled={disabled}
      className={cn(
        'rounded-lg border border-border p-4 shadow-xs ring-1 ring-border/40',
        'flex flex-col gap-4 transition-opacity',
        disabled && 'opacity-60 pointer-events-none',
        className,
      )}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={concurrencyId}>{t('concurrencyLabel')}</Label>
          <span className="text-sm font-medium text-foreground">
            {concurrency} {t('unitThreads')}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{t('concurrencyDescription')}</p>
        <Slider
          id={concurrencyId}
          min={minConcurrency}
          max={maxConcurrency}
          step={1}
          value={[concurrency]}
          onValueChange={handleConcurrencySliderChange}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={chunkSizeId}>{t('chunkSizeLabel')}</Label>
          <span className="text-sm font-medium text-foreground">
            {chunkSizeMb} {t('unitMB')}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{t('chunkSizeDescription')}</p>
        <Slider
          id={chunkSizeId}
          min={chunkMinMb}
          max={chunkMaxMb}
          step={1}
          value={[chunkSizeMb]}
          onValueChange={handleChunkSizeSliderChange}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
