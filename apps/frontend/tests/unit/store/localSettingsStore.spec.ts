import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLocalStorageMock } from '../_helpers/local-storage'

const loadStore = async () => {
  vi.resetModules()
  vi.stubGlobal('localStorage', createLocalStorageMock())
  return await import('../../../store/localSettingsStore')
}

describe('store/localSettingsStore (unit)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('keeps aria2 defaults and applies partial settings', async () => {
    const { useAria2Store } = await loadStore()

    expect(useAria2Store.getState().getSettings()).toEqual({
      protocol: 'http',
      host: 'localhost',
      port: 6800,
      path: '/jsonrpc',
      auth_secret: '',
      downloadPath: '',
    })

    useAria2Store.getState().setSettings({ host: '127.0.0.1', port: 6801 })
    expect(useAria2Store.getState().getSettings()).toEqual({
      protocol: 'http',
      host: '127.0.0.1',
      port: 6801,
      path: '/jsonrpc',
      auth_secret: '',
      downloadPath: '',
    })
  })

  it('updates toast position and aria2 test state', async () => {
    const { useToastPreferenceStore, useAria2TestStore } = await loadStore()

    useToastPreferenceStore.getState().setPosition('top-right')
    expect(useToastPreferenceStore.getState().position).toBe('top-right')

    useAria2TestStore.getState().setTestStatus('success')
    useAria2TestStore.getState().setTestMessage('ok')
    expect(useAria2TestStore.getState().testStatus).toBe('success')
    expect(useAria2TestStore.getState().testMessage).toBe('ok')
  })
})
