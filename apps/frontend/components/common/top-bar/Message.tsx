import { Bell } from 'lucide-react'
import { Button } from '@/components/shionui/Button'
import { Link } from '@/i18n/navigation'
import { useSocket, useSocketEvent } from '@/libs/socketio/core'
import { useCallback } from 'react'
import { MessageNewEvent, MessageUnreadEvent } from '@/interfaces/socketio/event.interface'
import { useMessageStore } from '@/store/messageStore'
import { Badge } from '@/components/shionui/Badge'
import { cn } from '@/utils/cn'

const MessageButton = () => {
  return (
    <Button
      size="icon"
      intent="neutral"
      appearance="ghost"
      renderIcon={<Bell className="size-4.5" />}
    />
  )
}

export const Message = () => {
  const { unreadCount, setUnreadCount } = useMessageStore()

  const socket = useSocket()
  const handleMessageNew = useCallback(
    (_data: MessageNewEvent) => setUnreadCount(unreadCount + 1),
    [unreadCount, setUnreadCount],
  )
  const handleMessageUnread = useCallback(
    (data: MessageUnreadEvent) => setUnreadCount(data.unread),
    [setUnreadCount],
  )
  const handleConnect = useCallback(() => {
    if (!socket) return
    socket.emit('message:unread:pull')
  }, [socket])

  useSocketEvent(socket, 'connect', handleConnect)
  useSocketEvent(socket, 'message:new', handleMessageNew)
  useSocketEvent(socket, 'message:unread', handleMessageUnread)

  return (
    <Link href="/message">
      {unreadCount > 0 ? (
        <Badge
          content={unreadCount > 99 ? '99+' : unreadCount.toString()}
          shape="circular"
          className={cn(
            'text-[0.75rem] z-10 pointer-events-none',
            unreadCount > 9 && 'text-[0.625rem] px-[2px] py-[1px]',
          )}
          offsetClassName="top-[10px] right-[10px]"
        >
          <MessageButton />
        </Badge>
      ) : (
        <MessageButton />
      )}
    </Link>
  )
}
