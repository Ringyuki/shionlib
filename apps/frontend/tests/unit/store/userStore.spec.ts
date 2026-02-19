import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserRole } from '../../../interfaces/user/user.interface'
import { supportedLocalesEnum } from '../../../config/i18n/supported'
import { createLocalStorageMock } from '../_helpers/local-storage'

const loadStore = async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', createLocalStorageMock())

  const post = vi.fn().mockResolvedValue({ code: 0 })
  vi.doMock('../../../utils/request', () => ({
    shionlibRequest: () => ({ post }),
  }))

  const mod = await import('../../../store/userStore')
  return { ...mod, post }
}

describe('store/userStore (unit)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('sets and updates user state', async () => {
    const { useShionlibUserStore } = await loadStore()

    useShionlibUserStore.getState().setUser({
      id: 7,
      name: 'alice',
      avatar: 'avatar.webp',
      cover: 'cover.webp',
      bio: 'bio',
      role: UserRole.ADMIN,
      lang: supportedLocalesEnum.JA,
    })
    useShionlibUserStore.getState().updateUser({ name: 'alice-2' })

    expect(useShionlibUserStore.getState().getUser()).toEqual(
      expect.objectContaining({
        id: 7,
        name: 'alice-2',
        role: UserRole.ADMIN,
      }),
    )
  })

  it('logout resets user and optionally sends logout request', async () => {
    const { useShionlibUserStore, post } = await loadStore()

    useShionlibUserStore.getState().setUser({
      id: 99,
      name: 'u',
      avatar: '',
      cover: '',
      bio: '',
      role: UserRole.USER,
      lang: supportedLocalesEnum.EN,
    })

    await useShionlibUserStore.getState().logout(true)
    expect(post).toHaveBeenCalledWith('/auth/logout')
    expect(useShionlibUserStore.getState().getUser()).toEqual(
      expect.objectContaining({ id: 0, role: UserRole.USER }),
    )
  })
})
