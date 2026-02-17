import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/shionui/Drawer'
import { GameCover } from '@/interfaces/game/game.interface'
import { GameCoverContent } from './GameCoverContent'
import { useTranslations } from 'next-intl'
import { ContentLimit } from '@/interfaces/user/user.interface'

interface GameCoverDrawerProps {
  covers: GameCover[]
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  content_limit?: ContentLimit
}

export const GameCoverDrawer = ({
  covers,
  title,
  open,
  onOpenChange,
  content_limit,
}: GameCoverDrawerProps) => {
  const t = useTranslations('Components.Game.Cover.GameCoverDrawer')
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
          <DrawerDescription>{title}</DrawerDescription>
        </DrawerHeader>
        <GameCoverContent
          covers={covers}
          title={title}
          content_limit={content_limit}
          className="overflow-auto px-4 pb-4"
        />
      </DrawerContent>
    </Drawer>
  )
}
