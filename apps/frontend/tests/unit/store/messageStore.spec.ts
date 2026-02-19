import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageMock } from '../_helpers/local-storage'

const loadStore = async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', createLocalStorageMock())
  return await import('../../../store/messageStore')
}

describe('store/messageStore (unit)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('sets and reads unread count', async () => {
    const { useMessageStore } = await loadStore()

    expect(useMessageStore.getState().unreadCount).toBe(0)
    useMessageStore.getState().setUnreadCount(12)
    expect(useMessageStore.getState().unreadCount).toBe(12)
  })
})
