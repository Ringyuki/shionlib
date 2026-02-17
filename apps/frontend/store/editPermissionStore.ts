import { create } from 'zustand'
import {
  GamePermission,
  DeveloperPermission,
  CharacterPermission,
} from '@/interfaces/edit/permisson.interface'

interface EditPermissionStore {
  gamePermissions: GamePermission | null
  setGamePermissions: (permissions: GamePermission) => void
  developerPermissions: DeveloperPermission | null
  setDeveloperPermissions: (permissions: DeveloperPermission) => void
  characterPermissions: CharacterPermission | null
  setCharacterPermissions: (permissions: CharacterPermission) => void
}

export const useEditPermissionStore = create<EditPermissionStore>()(set => ({
  gamePermissions: null,
  setGamePermissions: (permissions: GamePermission) => set({ gamePermissions: permissions }),
  developerPermissions: null,
  setDeveloperPermissions: (permissions: DeveloperPermission) =>
    set({ developerPermissions: permissions }),
  characterPermissions: null,
  setCharacterPermissions: (permissions: CharacterPermission) =>
    set({ characterPermissions: permissions }),
}))
