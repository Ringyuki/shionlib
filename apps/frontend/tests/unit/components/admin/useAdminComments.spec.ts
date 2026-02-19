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
  getAdminCommentDetail,
  rescanAdminComment,
  updateAdminCommentStatus,
  useAdminCommentList,
} from '../../../../components/admin/hooks/useAdminComments'

describe('components/admin/hooks/useAdminComments (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.post.mockReset()
    hoisted.patch.mockReset()
    hoisted.put.mockReset()
    hoisted.del.mockReset()
    hoisted.requestFactory.mockClear()
  })

  it('builds query string and fetches admin comment list', async () => {
    const payload = {
      items: [],
      page: 2,
      pageSize: 20,
      total: 0,
    }
    hoisted.get.mockResolvedValue({ data: payload })

    const { result } = renderHook(() =>
      useAdminCommentList({
        page: 2,
        limit: 20,
        search: 'hello',
        sortBy: 'created',
        sortOrder: 'DESC',
        status: 1,
        creatorId: 9,
        gameId: 7,
      } as any),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(hoisted.get).toHaveBeenCalledWith(
      '/admin/comments?page=2&pageSize=20&search=hello&sortBy=created&sortOrder=DESC&status=1&creatorId=9&gameId=7',
    )
    expect(result.current.data).toEqual(payload)
  })

  it('returns null data on list fetch failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    hoisted.get.mockRejectedValue(new Error('boom'))

    const { result } = renderHook(() => useAdminCommentList({ page: 1 } as any))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    errorSpy.mockRestore()
  })

  it('calls detail/update/rescan endpoints', async () => {
    hoisted.get.mockResolvedValue({ data: { id: 3 } })

    await expect(getAdminCommentDetail(3)).resolves.toEqual({ id: 3 })
    await updateAdminCommentStatus(3, { status: 2, notify: true })
    await rescanAdminComment(3)

    expect(hoisted.get).toHaveBeenCalledWith('/admin/comments/3')
    expect(hoisted.patch).toHaveBeenCalledWith('/admin/comments/3/status', {
      data: { status: 2, notify: true },
    })
    expect(hoisted.post).toHaveBeenCalledWith('/admin/comments/3/rescan')
  })
})
