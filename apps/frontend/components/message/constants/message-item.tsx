import { MessageTone, MessageType } from '@/interfaces/message/message.interface'
import { Bot, MessageSquareReply, Heart } from 'lucide-react'

export const typeConfig: Record<MessageType, { icon: React.ReactNode }> = {
  [MessageType.SYSTEM]: {
    icon: <Bot className="size-4" />,
  },
  [MessageType.COMMENT_REPLY]: {
    icon: <MessageSquareReply className="size-4" />,
  },
  [MessageType.COMMENT_LIKE]: {
    icon: <Heart className="size-4" />,
  },
}

export const toneConfig: Record<MessageTone, { color: string; iconBg: string }> = {
  [MessageTone.PRIMARY]: {
    color: 'text-primary',
    iconBg: 'from-primary/20 to-primary/30',
  },
  [MessageTone.SECONDARY]: {
    color: 'text-secondary-foreground',
    iconBg: 'from-secondary/60 to-secondary/80',
  },
  [MessageTone.SUCCESS]: {
    color: 'text-success',
    iconBg: 'from-success/20 to-success/30',
  },
  [MessageTone.WARNING]: {
    color: 'text-warning',
    iconBg: 'from-warning/20 to-warning/30',
  },
  [MessageTone.INFO]: {
    color: 'text-info',
    iconBg: 'from-info/20 to-info/30',
  },
  [MessageTone.DESTRUCTIVE]: {
    color: 'text-destructive',
    iconBg: 'from-destructive/20 to-destructive/30',
  },
  [MessageTone.NEUTRAL]: {
    color: 'text-foreground',
    iconBg: 'from-muted/50 to-muted/70',
  },
}
