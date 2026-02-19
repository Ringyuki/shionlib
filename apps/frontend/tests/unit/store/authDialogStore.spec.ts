import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthDialogStore } from '../../../store/authDialogStore'

describe('store/authDialogStore (unit)', () => {
  beforeEach(() => {
    useAuthDialogStore.setState(
      {
        authDialogOpen: false,
        authDialogType: 'login',
        logoutDialogOpen: false,
      },
      false,
    )
  })

  it('opens and closes auth dialog with type', () => {
    useAuthDialogStore.getState().openAuthDialog('register')
    expect(useAuthDialogStore.getState().authDialogOpen).toBe(true)
    expect(useAuthDialogStore.getState().authDialogType).toBe('register')

    useAuthDialogStore.getState().closeAuthDialog()
    expect(useAuthDialogStore.getState().authDialogOpen).toBe(false)
  })

  it('opens and closes logout dialog', () => {
    useAuthDialogStore.getState().openLogoutDialog()
    expect(useAuthDialogStore.getState().logoutDialogOpen).toBe(true)

    useAuthDialogStore.getState().closeLogoutDialog()
    expect(useAuthDialogStore.getState().logoutDialogOpen).toBe(false)
  })
})
