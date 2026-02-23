import { create } from 'zustand'

type AuthDialogType = 'login' | 'register'

interface GlobalDialogState {
  authDialogOpen: boolean
  authDialogType: AuthDialogType
  openAuthDialog: (type?: AuthDialogType) => void
  closeAuthDialog: () => void
  loginSuccessNonce: number
  markLoginSuccess: () => void
  logoutDialogOpen: boolean
  openLogoutDialog: () => void
  closeLogoutDialog: () => void
  passkeyBindNudgeDialogOpen: boolean
  openPasskeyBindNudgeDialog: () => void
  closePasskeyBindNudgeDialog: () => void
}

export const useAuthDialogStore = create<GlobalDialogState>()(set => ({
  authDialogOpen: false,
  authDialogType: 'login',
  openAuthDialog: (type = 'login') => set({ authDialogOpen: true, authDialogType: type }),
  closeAuthDialog: () => set({ authDialogOpen: false }),
  loginSuccessNonce: 0,
  markLoginSuccess: () => set({ loginSuccessNonce: Date.now() }),
  logoutDialogOpen: false,
  openLogoutDialog: () => set({ logoutDialogOpen: true }),
  closeLogoutDialog: () => set({ logoutDialogOpen: false }),
  passkeyBindNudgeDialogOpen: false,
  openPasskeyBindNudgeDialog: () => set({ passkeyBindNudgeDialogOpen: true }),
  closePasskeyBindNudgeDialog: () => set({ passkeyBindNudgeDialogOpen: false }),
}))
