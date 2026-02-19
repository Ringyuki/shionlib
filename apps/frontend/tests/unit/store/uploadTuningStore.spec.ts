import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageMock } from '../_helpers/local-storage'

const loadStore = async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', createLocalStorageMock())
  return await import('../../../store/uploadTuningStore')
}

describe('store/uploadTuningStore (unit)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('returns default tuning and supports partial updates', async () => {
    const { useUploadTuningStore } = await loadStore()

    expect(useUploadTuningStore.getState().getUploadTuning()).toEqual({
      concurrency: 4,
      chunkSize: 1024 * 1024 * 5,
    })

    useUploadTuningStore.getState().setUploadTuning({ concurrency: 8 })
    expect(useUploadTuningStore.getState().getUploadTuning()).toEqual({
      concurrency: 8,
      chunkSize: 1024 * 1024 * 5,
    })
  })
})
