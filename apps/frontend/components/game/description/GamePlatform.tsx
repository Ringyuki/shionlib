import { Badge } from '@/components/shionui/Badge'
import { MdWindow, MdWeb } from 'react-icons/md'
import { FaAndroid, FaLinux } from 'react-icons/fa'
import {
  SiPlaystationvita,
  SiNintendoswitch,
  SiPlaystationportable,
  SiPlaystation4,
  SiPlaystation3,
  SiPlaystation2,
  SiMacos,
  SiIos,
  SiNintendo3Ds,
} from 'react-icons/si'
import { FcDvdLogo } from 'react-icons/fc'
import { Platform } from '@/interfaces/game/game.interface'
import { platformNameMap, platformTokenMap } from '@/interfaces/game/game.interface'
import { cn } from '@/utils/cn'
import { MoreHorizontal, Plus } from 'lucide-react'

const PlatformIconMap: Record<Platform, React.ElementType> = {
  win: MdWindow,
  ios: SiIos,
  and: FaAndroid,
  lin: FaLinux,
  mac: SiMacos,
  ps2: SiPlaystation2,
  ps3: SiPlaystation3,
  ps4: SiPlaystation4,
  psp: SiPlaystationportable,
  psv: SiPlaystationvita,
  swi: SiNintendoswitch,
  dvd: FcDvdLogo,
  mob: MdWeb,
  web: MdWeb,
  vnd: MdWeb,
  drc: MdWeb,
  gba: SiNintendo3Ds,
  nds: SiNintendo3Ds,
  other: MoreHorizontal,
}
interface GamePlatformProps {
  platform: Platform[]
  max?: number
  show_more_count?: boolean
  className?: string
}

export const GamePlatform = ({ platform, className, max, show_more_count }: GamePlatformProps) => {
  let more_count = 0
  if (max && platform.length > max) {
    more_count = platform.length - max
    platform = platform.slice(0, max)
  }
  return (
    platform.length > 0 && (
      <div className={cn('flex flex-wrap gap-2 items-center', className)}>
        {platform
          .filter(p => Object.keys(PlatformIconMap).includes(p))
          ?.map(p => {
            const IconComponent = PlatformIconMap[p]
            return (
              <Badge
                key={p}
                style={{
                  backgroundColor: platformTokenMap[p].bg,
                  color: platformTokenMap[p].fg,
                  userSelect: 'none',
                }}
              >
                <IconComponent className="size-4" />
                {platformNameMap[p]}
              </Badge>
            )
          })}
        {show_more_count && more_count > 0 && (
          <Badge variant="secondary" className="gap-[1px]">
            <Plus />
            {more_count}
          </Badge>
        )}
      </div>
    )
  )
}
