import { beforeEach, describe, expect, it } from 'vitest'
import { useEditPermissionStore } from '../../../store/editPermissionStore'

describe('store/editPermissionStore (unit)', () => {
  beforeEach(() => {
    useEditPermissionStore.setState(
      {
        gamePermissions: null,
        developerPermissions: null,
        characterPermissions: null,
      },
      false,
    )
  })

  it('stores permissions for game/developer/character independently', () => {
    const gamePermissions = { canEditScalar: true } as any
    const developerPermissions = { canEditScalar: false } as any
    const characterPermissions = { canEditScalar: true } as any

    useEditPermissionStore.getState().setGamePermissions(gamePermissions)
    useEditPermissionStore.getState().setDeveloperPermissions(developerPermissions)
    useEditPermissionStore.getState().setCharacterPermissions(characterPermissions)

    expect(useEditPermissionStore.getState().gamePermissions).toEqual(gamePermissions)
    expect(useEditPermissionStore.getState().developerPermissions).toEqual(developerPermissions)
    expect(useEditPermissionStore.getState().characterPermissions).toEqual(characterPermissions)
  })
})
