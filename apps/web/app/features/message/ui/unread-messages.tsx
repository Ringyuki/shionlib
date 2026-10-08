import type { ReactNode } from 'react'
import { useUnreadMessages } from '../use-unread-messages'

type UnreadMessagesProps = {
  loaded: number
  signedIn: boolean
  children: (unread: number) => ReactNode
}

export function UnreadMessages({ loaded, signedIn, children }: UnreadMessagesProps) {
  return children(useUnreadMessages(loaded, signedIn))
}
