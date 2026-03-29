import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/shionui/MultiSelect'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Monitor } from 'lucide-react'
import { PlatformOptions, platformNameMap } from '@/interfaces/game/game.interface'

interface PlatformFilterProps {
  onPlatformChange: (platforms: string[]) => void
  value?: string[]
}

export const PlatformFilter = ({ onPlatformChange, value }: PlatformFilterProps) => {
  const t = useTranslations('Components.Game.Filter.Platform')
  const [platforms, setPlatforms] = useState<string[]>(value ?? [])

  const handlePlatformChange = (platforms: string[]) => {
    setPlatforms(platforms)
    onPlatformChange(platforms)
  }

  return (
    <div className="flex flex-col gap-2 max-w-full md:min-w-64">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        <Monitor className="size-3.5" />
        {t('platform')}
      </div>
      <MultiSelect defaultValue={value} value={platforms} onValueChange={handlePlatformChange}>
        <MultiSelectTrigger className="w-64 text-base">
          <MultiSelectValue
            placeholder={t('selectPlatform')}
            resolveLabel={v => platformNameMap[v as keyof typeof platformNameMap] ?? v}
          />
        </MultiSelectTrigger>
        <MultiSelectContent>
          {PlatformOptions.map(opt => (
            <MultiSelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </MultiSelectItem>
          ))}
        </MultiSelectContent>
      </MultiSelect>
    </div>
  )
}
