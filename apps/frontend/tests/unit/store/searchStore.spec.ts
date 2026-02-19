import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageMock } from '../_helpers/local-storage'

const loadStore = async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', createLocalStorageMock())
  return await import('../../../store/searchStore')
}

describe('store/searchStore (unit)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('adds history with dedupe, sorting and max size', async () => {
    const { useSearchStore } = await loadStore()
    const store = useSearchStore.getState()

    store.addHistory({ id: 1, query: 'a', created_at: '2026-01-01T00:00:00.000Z' } as any)
    store.addHistory({ id: 2, query: 'b', created_at: '2026-01-02T00:00:00.000Z' } as any)
    store.addHistory({ id: 3, query: 'a', created_at: '2026-01-03T00:00:00.000Z' } as any)

    const history = useSearchStore.getState().history
    expect(history).toHaveLength(2)
    expect(history[0]?.query).toBe('a')
    expect(history[0]?.id).toBe(3)
  })

  it('toggles search and animeTrace dialog state', async () => {
    const { useSearchStore } = await loadStore()

    useSearchStore.getState().openSearchDialog()
    expect(useSearchStore.getState().searchDialogOpen).toBe(true)
    useSearchStore.getState().closeSearchDialog()
    expect(useSearchStore.getState().searchDialogOpen).toBe(false)

    useSearchStore.getState().openAnimeTraceDialog()
    expect(useSearchStore.getState().animeTraceDialogOpen).toBe(true)
    useSearchStore.getState().closeAnimeTraceDialog()
    expect(useSearchStore.getState().animeTraceDialogOpen).toBe(false)
  })
})
