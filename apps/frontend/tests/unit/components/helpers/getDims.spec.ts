// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDims } from '../../../../components/game/edit/cover/helpers/getDims'

describe('components/game/edit/cover/helpers/getDims (unit)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves image width and height for uploaded file', async () => {
    const createObjectURL = vi.fn(() => 'blob://cover')
    vi.stubGlobal('URL', { createObjectURL } as any)

    class MockImage {
      public width = 1280
      public height = 720
      public onload: null | (() => void) = null

      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.()
        })
      }
    }

    vi.stubGlobal('Image', MockImage as any)

    const file = new File(['cover'], 'cover.webp', { type: 'image/webp' })
    const dims = await getDims(file)

    expect(createObjectURL).toHaveBeenCalledWith(file)
    expect(dims).toEqual([1280, 720])
  })
})
