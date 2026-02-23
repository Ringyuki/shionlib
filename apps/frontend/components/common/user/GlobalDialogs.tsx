'use client'

import { LoginOrRegisteDialog } from '@/components/common/user/LoginOrRegisteDialog'
import { LogoutDialog } from '@/components/common/user/LogoutDialog'
import { AnimeTraceDialog } from '@/components/common/search/animetrace/Dialog'
import { PasskeyBindNudgeDialog } from '@/components/common/user/passkey/PasskeyBindNudgeDialog'
import { PasskeyBindNudgeWatcher } from '@/components/common/user/passkey/PasskeyBindNudgeWatcher'
import { useAuthDialogStore } from '@/store/authDialogStore'
import { useSearchStore } from '@/store/searchStore'
import { SearchDialog } from '../search/SearchDialog'

export const GlobalDialogs = () => {
  const {
    authDialogOpen,
    authDialogType,
    closeAuthDialog,
    logoutDialogOpen,
    closeLogoutDialog,
    passkeyBindNudgeDialogOpen,
    closePasskeyBindNudgeDialog,
  } = useAuthDialogStore()
  const { animeTraceDialogOpen, closeAnimeTraceDialog } = useSearchStore()
  return (
    <>
      <PasskeyBindNudgeWatcher />
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
      <PasskeyBindNudgeDialog
        open={passkeyBindNudgeDialogOpen}
        onOpenChange={open => {
          if (!open) closePasskeyBindNudgeDialog()
        }}
      />
    </>
  )
}
