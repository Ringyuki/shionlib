import { cn, Tag } from '@hina-ui/react'
import type { ComponentProps } from 'react'
import { useMessages } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import type { Platform } from '../game'
import { platformFrom } from '../game.schema'
import { PlatformIcon } from './platform-icon'

const colors: Record<Platform, string> = {
  win: 'bg-platform-win text-platform-win-fg',
  mac: 'bg-platform-mac text-platform-mac-fg',
  ios: 'bg-platform-ios text-platform-ios-fg',
  and: 'bg-platform-and text-platform-and-fg',
  lin: 'bg-platform-lin text-platform-lin-fg',
  ps3: 'bg-platform-ps3 text-platform-ps3-fg',
  ps4: 'bg-platform-ps4 text-platform-ps4-fg',
  psv: 'bg-platform-psv text-platform-psv-fg',
  psp: 'bg-platform-psp text-platform-psp-fg',
  swi: 'bg-platform-swi text-platform-swi-fg',
  dvd: 'bg-platform-dvd text-platform-dvd-fg',
}

type PlatformTagProps = {
  platform: string
  size?: ComponentProps<typeof Tag>['size']
  className?: string
}

export function PlatformTag({ platform, size = 'sm', className }: PlatformTagProps) {
  const labels = useMessages().game.platform
  const known = platformFrom(platform)
  const label = labelOf(labels, platform)
  if (known === undefined) {
    return (
      <Tag size={size} variant="solid" className={className}>
        {label}
      </Tag>
    )
  }
  return (
    <Tag size={size} variant="solid" className={cn(colors[known], className)}>
      <PlatformIcon platform={known} />
      {label}
    </Tag>
  )
}
