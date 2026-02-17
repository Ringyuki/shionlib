import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface MessageStore {
  unreadCount: number
  setUnreadCount: (unreadCount: number) => void
}

export const useMessageStore = create<MessageStore>()(
  persist(
    set => ({
      unreadCount: 0,
      setUnreadCount: (unreadCount: number) => set({ unreadCount }),
    }),
    {
      name: 'shionlib-message-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
