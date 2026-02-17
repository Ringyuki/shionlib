'use client'

import { io, Socket } from 'socket.io-client'
import { Event, MessageNewEvent, MessageUnreadEvent } from '@/interfaces/socketio/event.interface'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

const socketUrl = process.env.NEXT_PUBLIC_SOCKETIO_URL || ''
const isBrowser = typeof window !== 'undefined'

let socketInstance: Socket | null = null

const getSocket = (): Socket | null => {
  if (!isBrowser) return null
  if (!socketInstance) {
    socketInstance = io(`${socketUrl}/ws`, {
      withCredentials: true,
      autoConnect: false,
      transports: ['websocket'],
    })
  }
  return socketInstance
}

// Context
const SocketContext = createContext<Socket | null>(null)

interface SocketProviderProps {
  children: ReactNode
}

export const SocketProvider = ({ children }: SocketProviderProps) => {
  const [socket] = useState(() => getSocket())

  useEffect(() => {
    if (!socket) return
    socket.connect()
    return () => {
      socket.disconnect()
    }
  }, [socket])

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}

// Hook
export const useSocket = (): Socket | null => {
  return useContext(SocketContext)
}

export const useSocketEvent = <T extends MessageNewEvent | MessageUnreadEvent>(
  socket: Socket | null,
  event: Event,
  callback: (data: T) => void,
): void => {
  useEffect(() => {
    if (!socket) return
    socket.on(event, callback)
    return () => {
      socket.off(event, callback)
    }
  }, [socket, event, callback])
}
