'use client'

import { useState, useEffect, useCallback } from 'react'
import { Message } from '@/interfaces/message/message.interface'
import { shionlibRequest } from '@/utils/request'
import { Detail } from './Detail'
import { DetailSkeleton } from './DetailSkeleton'
import { cn } from '@/utils/cn'
import { useSocket, useSocketEvent } from '@/libs/socketio/core'

interface DetailContentProps {
  messageId: number | null
  open: boolean
  onRead?: (id: number) => void
  className?: string
}

export const DetailContent = ({ messageId, open, onRead, className }: DetailContentProps) => {
  const [message, setMessage] = useState<Message | null>(null)
  const [loading, setLoading] = useState(false)

  const socket = useSocket()
  const fetchData = async (id: number) => {
    try {
      setLoading(true)
      setMessage(null)
      const res = await shionlibRequest().get<Message>(`/message/${id}`)
      setMessage(res.data)
      onRead?.(id)
      socket?.emit('message:unread:pull')
    } catch {
    } finally {
      setLoading(false)
    }
  }
  const fetchMessage = useCallback(fetchData, [onRead, socket])

  useEffect(() => {
    if (open && messageId) {
      fetchMessage(messageId)
    }
  }, [open, messageId, fetchMessage])

  return (
    <div className={cn('overflow-y-auto', className)}>
      {loading ? <DetailSkeleton /> : message ? <Detail message={message} /> : null}
    </div>
  )
}
