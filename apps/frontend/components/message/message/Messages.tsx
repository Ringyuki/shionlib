'use client'

import { useState, useCallback, useEffect } from 'react'
import { Message as MessageInterface } from '@/interfaces/message/message.interface'
import { PaginatedMeta } from '@/interfaces/api/shionlib-api-res.interface'
import { Item } from './Item'
import { Pagination } from '@/components/common/content/Pagination'
import { Empty } from '@/components/common/content/Empty'
import { DetailModal } from '../detail/DetailModal'
import { useSearchParams } from 'next/navigation'

interface MessagesProps {
  messages: MessageInterface[]
  meta: PaginatedMeta
}

export const Messages = ({ messages, meta }: MessagesProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null)
  const [localMessages, setLocalMessages] = useState(messages)
  const searchParams = useSearchParams()
  useEffect(() => {
    setLocalMessages(messages)
  }, [messages])

  const handleItemClick = useCallback((id: number) => {
    setSelectedMessageId(id)
    setDrawerOpen(true)
  }, [])

  const handleRead = useCallback((id: number) => {
    setLocalMessages(prev => prev.map(msg => (msg.id === id ? { ...msg, read: true } : msg)))
  }, [])

  if (localMessages.length === 0) return <Empty />

  const unread = searchParams.get('unread')
  const extraQuery = unread === null ? {} : { unread: unread === 'true' }
  return (
    <>
      <div className="flex flex-col gap-4">
        {localMessages.map(message => (
          <Item key={message.id} message={message} onClick={handleItemClick} />
        ))}
        {meta.totalPages > 1 && (
          <Pagination
            currentPage={meta.currentPage}
            totalPages={meta.totalPages}
            extraQuery={extraQuery}
          />
        )}
      </div>
      <DetailModal
        messageId={selectedMessageId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onRead={handleRead}
      />
    </>
  )
}
