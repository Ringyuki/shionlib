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
  adminAdjustQuotaSize,
  adminAdjustQuotaUsed,
  adminBanUser,
  adminForceLogout,
  adminResetQuotaUsed,
  adminResetUserPassword,
  adminUnbanUser,
  adminUpdateUserProfile,
  adminUpdateUserRole,
  getAdminUserDetail,
  getAdminUserPermissions,
  getAdminUserSessions,
  updateAdminUserPermissions,
  useAdminUserList,
} from '../../../../components/admin/hooks/useAdminUsers'

describe('components/admin/hooks/useAdminUsers (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.post.mockReset()
    hoisted.patch.mockReset()
    hoisted.put.mockReset()
    hoisted.del.mockReset()
    hoisted.requestFactory.mockClear()
  })

  it('fetches user list with query params', async () => {
    const payload = { items: [], page: 1, pageSize: 20, total: 0 }
    hoisted.get.mockResolvedValue({ data: payload })

    const { result } = renderHook(() =>
      useAdminUserList({
        page: 1,
        limit: 20,
        search: 'ring',
        sortBy: 'created',
        sortOrder: 'DESC',
        role: 2,
        status: 1,
      } as any),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(hoisted.get).toHaveBeenCalledWith(
      '/admin/users?page=1&pageSize=20&search=ring&sortBy=created&sortOrder=DESC&role=2&status=1',
    )
    expect(result.current.data).toEqual(payload)
  })

  it('fetches user detail/sessions/permissions', async () => {
    hoisted.get
      .mockResolvedValueOnce({ data: { id: 7 } })
      .mockResolvedValueOnce({ data: { items: [], page: 2, pageSize: 5, total: 0 } })
      .mockResolvedValueOnce({ data: { entity: 'GAME', allowBits: [1, 2] } })

    await expect(getAdminUserDetail(7)).resolves.toEqual({ id: 7 })
    await expect(getAdminUserSessions(7, { page: 2, limit: 5, status: 1 } as any)).resolves.toEqual(
      {
        items: [],
        page: 2,
        pageSize: 5,
        total: 0,
      },
    )
    await expect(getAdminUserPermissions(7, 'GAME' as any)).resolves.toEqual({
      entity: 'GAME',
      allowBits: [1, 2],
    })

    expect(hoisted.get).toHaveBeenNthCalledWith(1, '/admin/users/7')
    expect(hoisted.get).toHaveBeenNthCalledWith(
      2,
      '/admin/users/7/sessions?page=2&pageSize=5&status=1',
    )
    expect(hoisted.get).toHaveBeenNthCalledWith(3, '/admin/users/7/permissions', {
      params: { entity: 'GAME' },
    })
  })

  it('calls user mutation endpoints', async () => {
    await adminUpdateUserProfile(7, { name: 'new-name' })
    await adminUpdateUserRole(7, 3)
    await adminBanUser(7, { is_permanent: true })
    await adminUnbanUser(7)
    await adminResetUserPassword(7, 'password')
    await adminForceLogout(7)
    await updateAdminUserPermissions(7, 'GAME' as any, [1, 2, 3])
    await adminAdjustQuotaSize(7, { action: 'ADD', amount: 1024 })
    await adminAdjustQuotaUsed(7, { action: 'USE', amount: 10 })
    await adminResetQuotaUsed(7)

    expect(hoisted.patch).toHaveBeenCalledWith('/admin/users/7/profile', {
      data: { name: 'new-name' },
    })
    expect(hoisted.patch).toHaveBeenCalledWith('/admin/users/7/role', { data: { role: 3 } })
    expect(hoisted.post).toHaveBeenCalledWith('/admin/users/7/ban', {
      data: { is_permanent: true },
    })
    expect(hoisted.post).toHaveBeenCalledWith('/admin/users/7/unban')
    expect(hoisted.post).toHaveBeenCalledWith('/admin/users/7/reset-password', {
      data: { password: 'password' },
    })
    expect(hoisted.post).toHaveBeenCalledWith('/admin/users/7/force-logout')
    expect(hoisted.patch).toHaveBeenCalledWith('/admin/users/7/permissions', {
      data: { entity: 'GAME', allowBits: [1, 2, 3] },
    })
    expect(hoisted.patch).toHaveBeenCalledWith('/admin/users/7/quota/size', {
      data: { action: 'ADD', amount: 1024 },
    })
    expect(hoisted.patch).toHaveBeenCalledWith('/admin/users/7/quota/used', {
      data: { action: 'USE', amount: 10 },
    })
    expect(hoisted.post).toHaveBeenCalledWith('/admin/users/7/quota/reset-used')
  })
})
