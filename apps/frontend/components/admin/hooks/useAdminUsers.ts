'use client'

import { useCallback, useEffect, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import {
  AdminUserItem,
  AdminUserDetail,
  AdminUserSession,
  AdminUserListQuery,
  AdminUserSessionsQuery,
  AdminUserPermissionDetail,
  AdminPermissionEntity,
} from '@/interfaces/admin/user.interface'

export function useAdminUserList(query: AdminUserListQuery = {}) {
  const [data, setData] = useState<PaginatedResponse<AdminUserItem> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.page) params.set('page', query.page.toString())
      if (query.limit) params.set('pageSize', query.limit.toString())
      if (query.search) params.set('search', query.search)
      if (query.sortBy) params.set('sortBy', query.sortBy)
      if (query.sortOrder) params.set('sortOrder', query.sortOrder)
      if (query.role !== undefined) params.set('role', query.role.toString())
      if (query.status !== undefined) params.set('status', query.status.toString())

      const queryString = params.toString()
      const url = `/admin/users${queryString ? `?${queryString}` : ''}`
      const res = await shionlibRequest().get<PaginatedResponse<AdminUserItem>>(url)
      setData(res.data)
    } catch (error) {
      console.error('Failed to fetch user list:', error)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [
    query.page,
    query.limit,
    query.search,
    query.sortBy,
    query.sortOrder,
    query.role,
    query.status,
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, refetch: fetchData }
}

export async function getAdminUserDetail(id: number): Promise<AdminUserDetail> {
  const res = await shionlibRequest().get<AdminUserDetail>(`/admin/users/${id}`)
  return res.data as AdminUserDetail
}

export async function getAdminUserSessions(
  id: number,
  query: AdminUserSessionsQuery = {},
): Promise<PaginatedResponse<AdminUserSession>> {
  const params = new URLSearchParams()
  if (query.page) params.set('page', query.page.toString())
  if (query.limit) params.set('pageSize', query.limit.toString())
  if (query.status !== undefined) params.set('status', query.status.toString())
  const queryString = params.toString()
  const url = `/admin/users/${id}/sessions${queryString ? `?${queryString}` : ''}`
  const res = await shionlibRequest().get<PaginatedResponse<AdminUserSession>>(url)
  return res.data as PaginatedResponse<AdminUserSession>
}

export async function adminUpdateUserProfile(
  id: number,
  data: {
    name?: string
    email?: string
    lang?: string
    content_limit?: number
  },
) {
  await shionlibRequest().patch(`/admin/users/${id}/profile`, { data })
}

export async function adminUpdateUserRole(id: number, role: number) {
  await shionlibRequest().patch(`/admin/users/${id}/role`, { data: { role } })
}

export async function adminBanUser(
  id: number,
  data: {
    banned_reason?: string
    banned_duration_days?: number
    is_permanent?: boolean
    delete_user_comments?: boolean
  },
) {
  await shionlibRequest().post(`/admin/users/${id}/ban`, { data })
}

export async function adminUnbanUser(id: number) {
  await shionlibRequest().post(`/admin/users/${id}/unban`)
}

export async function adminResetUserPassword(id: number, password: string) {
  await shionlibRequest().post(`/admin/users/${id}/reset-password`, { data: { password } })
}

export async function adminForceLogout(id: number) {
  await shionlibRequest().post(`/admin/users/${id}/force-logout`)
}

export async function getAdminUserPermissions(id: number, entity: AdminPermissionEntity) {
  const res = await shionlibRequest().get<AdminUserPermissionDetail>(
    `/admin/users/${id}/permissions`,
    { params: { entity } },
  )
  return res.data as AdminUserPermissionDetail
}

export async function updateAdminUserPermissions(
  id: number,
  entity: AdminPermissionEntity,
  allowBits: number[],
) {
  await shionlibRequest().patch(`/admin/users/${id}/permissions`, {
    data: { entity, allowBits },
  })
}

export async function adminAdjustQuotaSize(
  id: number,
  data: { action: 'ADD' | 'SUB'; amount: number; action_reason?: string },
) {
  await shionlibRequest().patch(`/admin/users/${id}/quota/size`, { data })
}

export async function adminAdjustQuotaUsed(
  id: number,
  data: { action: 'USE' | 'ADD'; amount: number; action_reason?: string },
) {
  await shionlibRequest().patch(`/admin/users/${id}/quota/used`, { data })
}

export async function adminResetQuotaUsed(id: number) {
  await shionlibRequest().post(`/admin/users/${id}/quota/reset-used`)
}
