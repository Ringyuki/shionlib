import { create } from 'zustand'

type AuthDialogType = 'login' | 'register'

interface GlobalDialogState {
  authDialogOpen: boolean
  authDialogType: AuthDialogType
  openAuthDialog: (type?: AuthDialogType) => void
  closeAuthDialog: () => void
  logoutDialogOpen: boolean
  openLogoutDialog: () => void
  closeLogoutDialog: () => void
}

export const useAuthDialogStore = create<GlobalDialogState>()(set => ({
  authDialogOpen: false,
  authDialogType: 'login',
  openAuthDialog: (type = 'login') => set({ authDialogOpen: true, authDialogType: type }),
  closeAuthDialog: () => set({ authDialogOpen: false }),
  logoutDialogOpen: false,
  openLogoutDialog: () => set({ logoutDialogOpen: true }),
  closeLogoutDialog: () => set({ logoutDialogOpen: false }),
}))
