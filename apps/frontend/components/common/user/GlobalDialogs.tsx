'use client'

import { LoginOrRegisteDialog } from '@/components/common/user/LoginOrRegisteDialog'
import { LogoutDialog } from '@/components/common/user/LogoutDialog'
import { AnimeTraceDialog } from '@/components/common/search/animetrace/Dialog'
import { useAuthDialogStore } from '@/store/authDialogStore'
import { useSearchStore } from '@/store/searchStore'
import { SearchDialog } from '../search/SearchDialog'

export const GlobalDialogs = () => {
  const { authDialogOpen, authDialogType, closeAuthDialog, logoutDialogOpen, closeLogoutDialog } =
    useAuthDialogStore()
  const { animeTraceDialogOpen, closeAnimeTraceDialog } = useSearchStore()
  return (
    <>
      <SearchDialog />
      <AnimeTraceDialog
        open={animeTraceDialogOpen}
        onOpenChange={open => {
          if (!open) closeAnimeTraceDialog()
        }}
      />
      <LoginOrRegisteDialog
        hideTrigger
        open={authDialogOpen}
        dialogType={authDialogType}
        onOpenChange={open => {
          if (!open) closeAuthDialog()
        }}
      />

      <LogoutDialog
        open={logoutDialogOpen}
        onOpenChange={open => {
          if (!open) closeLogoutDialog()
        }}
      />
    </>
  )
}
