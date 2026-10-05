import { cn, Tag } from '@hina-ui/react'
import type { ComponentType } from 'react'
import { BsNintendoSwitch } from 'react-icons/bs'
import { FaAndroid, FaLinux } from 'react-icons/fa'
import { MdAlbum, MdWindow } from 'react-icons/md'
import {
  SiIos,
  SiMacos,
  SiPlaystation3,
  SiPlaystation4,
  SiPlaystationportable,
  SiPlaystationvita,
} from 'react-icons/si'
import { useMessages } from 'use-intl'
import { labelOf } from '~/shared/i18n/labels'
import type { Platform } from '../game'
import { platformFrom } from '../game.schema'

const looks: Record<
  Platform,
  { icon: ComponentType<{ 'aria-hidden'?: boolean }>; colors: string }
> = {
  win: { icon: MdWindow, colors: 'bg-platform-win text-platform-win-fg' },
  mac: { icon: SiMacos, colors: 'bg-platform-mac text-platform-mac-fg' },
  ios: { icon: SiIos, colors: 'bg-platform-ios text-platform-ios-fg' },
  and: { icon: FaAndroid, colors: 'bg-platform-and text-platform-and-fg' },
  lin: { icon: FaLinux, colors: 'bg-platform-lin text-platform-lin-fg' },
  ps3: { icon: SiPlaystation3, colors: 'bg-platform-ps3 text-platform-ps3-fg' },
  ps4: { icon: SiPlaystation4, colors: 'bg-platform-ps4 text-platform-ps4-fg' },
  psv: { icon: SiPlaystationvita, colors: 'bg-platform-psv text-platform-psv-fg' },
  psp: { icon: SiPlaystationportable, colors: 'bg-platform-psp text-platform-psp-fg' },
  swi: { icon: BsNintendoSwitch, colors: 'bg-platform-swi text-platform-swi-fg' },
  dvd: { icon: MdAlbum, colors: 'bg-platform-dvd text-platform-dvd-fg' },
}

type PlatformTagProps = {
  platform: string
  size?: 'sm' | 'md'
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
  const { icon: Icon, colors } = looks[known]
  return (
    <Tag size={size} variant="solid" className={cn(colors, className)}>
      <Icon aria-hidden />
      {label}
    </Tag>
  )
}
