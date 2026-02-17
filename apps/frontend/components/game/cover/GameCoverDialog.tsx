import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/shionui/Dialog'
import { GameCoverContent } from './GameCoverContent'
import { GameCover } from '@/interfaces/game/game.interface'
import { useTranslations } from 'next-intl'
import { ContentLimit } from '@/interfaces/user/user.interface'

interface GameCoverDialogProps {
  covers: GameCover[]
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
  content_limit?: ContentLimit
}

export const GameCoverDialog = ({
  covers,
  title,
  open,
  onOpenChange,
  content_limit,
}: GameCoverDialogProps) => {
  const t = useTranslations('Components.Game.Cover.GameCoverDialog')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[720px]">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <GameCoverContent covers={covers} title={title} content_limit={content_limit} />
      </DialogContent>
    </Dialog>
  )
}
