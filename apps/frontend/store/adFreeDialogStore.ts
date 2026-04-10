import { create } from 'zustand'

interface AdFreeDialogState {
  adFreeDialogOpen: boolean
  openAdFreeDialog: () => void
  closeAdFreeDialog: () => void
}

export const useAdFreeDialogStore = create<AdFreeDialogState>()(set => ({
  adFreeDialogOpen: false,
  openAdFreeDialog: () => set({ adFreeDialogOpen: true }),
  closeAdFreeDialog: () => set({ adFreeDialogOpen: false }),
}))
