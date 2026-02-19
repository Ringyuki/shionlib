// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hoisted = vi.hoisted(() => {
  const get = vi.fn()
  const post = vi.fn()
  const patch = vi.fn()
  const put = vi.fn()
  const del = vi.fn()

  return {
    get,
    post,
    patch,
    put,
    del,
    requestFactory: vi.fn(() => ({
      get,
      post,
      patch,
      put,
      delete: del,
    })),
  }
})

vi.mock('@/utils/request', () => ({
  shionlibRequest: hoisted.requestFactory,
}))

import {
  addGameToRecentUpdate,
  deleteGame,
  removeGameFromRecentUpdate,
  updateGameScalar,
  updateGameStatus,
  useAdminCharacterList,
  useAdminDeveloperList,
  useAdminGameList,
} from '../../../../components/admin/hooks/useAdminContent'

describe('components/admin/hooks/useAdminContent (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.post.mockReset()
    hoisted.patch.mockReset()
    hoisted.put.mockReset()
    hoisted.del.mockReset()
    hoisted.requestFactory.mockClear()
  })

  it('fetches game list with query params', async () => {
    const payload = { items: [], page: 1, pageSize: 10, total: 0 }
    hoisted.get.mockResolvedValue({ data: payload })

    const { result } = renderHook(() =>
      useAdminGameList({
        page: 1,
        limit: 10,
        search: 'abc',
        sortBy: 'id',
        sortOrder: 'ASC',
        status: 1,
      } as any),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(hoisted.get).toHaveBeenCalledWith(
      '/admin/content/games?page=1&pageSize=10&search=abc&sortBy=id&sortOrder=ASC&status=1',
    )
    expect(result.current.data).toEqual(payload)
  })

  it('fetches character and developer lists', async () => {
    const payload = { items: [], page: 2, pageSize: 5, total: 0 }
    hoisted.get.mockResolvedValue({ data: payload })

    const character = renderHook(() =>
      useAdminCharacterList({
        page: 2,
        limit: 5,
        search: 'char',
        sortBy: 'created',
        sortOrder: 'DESC',
      } as any),
    )

    await waitFor(() => {
      expect(character.result.current.isLoading).toBe(false)
    })

    expect(hoisted.get).toHaveBeenCalledWith(
      '/admin/content/characters?page=2&pageSize=5&search=char&sortBy=created&sortOrder=DESC',
    )

    hoisted.get.mockClear()
    hoisted.get.mockResolvedValue({ data: payload })

    const developer = renderHook(() =>
      useAdminDeveloperList({
        page: 3,
        limit: 6,
        search: 'dev',
        sortBy: 'id',
        sortOrder: 'ASC',
      } as any),
    )

    await waitFor(() => {
      expect(developer.result.current.isLoading).toBe(false)
    })

    expect(hoisted.get).toHaveBeenCalledWith(
      '/admin/content/developers?page=3&pageSize=6&search=dev&sortBy=id&sortOrder=ASC',
    )

    character.unmount()
    developer.unmount()
  })

  it('calls game mutation endpoints', async () => {
    await updateGameStatus(11, 2)
    await updateGameScalar(11, { name: 'new-name' })
    await deleteGame(11)
    await addGameToRecentUpdate(11)
    await removeGameFromRecentUpdate(11)

    expect(hoisted.patch).toHaveBeenCalledWith('/admin/content/games/11/status', {
      data: { status: 2 },
    })
    expect(hoisted.patch).toHaveBeenCalledWith('/admin/content/games/11/edit/scalar', {
      data: { name: 'new-name' },
    })
    expect(hoisted.del).toHaveBeenCalledWith('/admin/content/games/11')
    expect(hoisted.put).toHaveBeenCalledWith('/admin/content/games/11/recent-update')
    expect(hoisted.del).toHaveBeenCalledWith('/admin/content/games/11/recent-update')
  })
})
