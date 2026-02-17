import { Bell, MessageCircle, MessageSquareReply, Heart } from 'lucide-react'

export interface SidebarItem {
  id: number
  title: string
  icon: React.ReactNode
  link: string
}

export const sidebarItems: SidebarItem[] = [
  {
    id: 1,
    title: 'all',
    icon: <Bell className="size-4" />,
    link: '/message',
  },
  {
    id: 2,
    title: 'system',
    icon: <MessageCircle className="size-4" />,
    link: '/message/system',
  },
  {
    id: 3,
    title: 'reply',
    icon: <MessageSquareReply className="size-4" />,
    link: '/message/comment-reply',
  },
  {
    id: 4,
    title: 'like',
    icon: <Heart className="size-4" />,
    link: '/message/comment-like',
  },
]
