'use client'

import { useCallback, useEffect, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import {
  AdminAdItem,
  AdminAdListQuery,
  CreateAdPayload,
  UpdateAdPayload,
} from '@/interfaces/admin/ad.interface'

export function useAdminAdList(query: AdminAdListQuery = {}) {
  const [data, setData] = useState<PaginatedResponse<AdminAdItem> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.page) params.set('page', query.page.toString())
      if (query.pageSize) params.set('pageSize', query.pageSize.toString())
      if (query.placement) params.set('placement', query.placement)
      if (query.enabled !== undefined) params.set('enabled', query.enabled.toString())

      const queryString = params.toString()
      const url = `/admin/ad${queryString ? `?${queryString}` : ''}`
      const res = await shionlibRequest().get<PaginatedResponse<AdminAdItem>>(url)
      setData(res.data)
    } catch (error) {
      console.error('Failed to fetch ad list:', error)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [query.page, query.pageSize, query.placement, query.enabled])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, refetch: fetchData }
}

export async function createAdminAd(data: CreateAdPayload): Promise<AdminAdItem> {
  const res = await shionlibRequest().post<AdminAdItem>('/admin/ad', { data })
  return res.data as AdminAdItem
}

export async function updateAdminAd(id: number, data: UpdateAdPayload): Promise<AdminAdItem> {
  const res = await shionlibRequest().patch<AdminAdItem>(`/admin/ad/${id}`, { data })
  return res.data as AdminAdItem
}

export async function deleteAdminAd(id: number): Promise<void> {
  await shionlibRequest().delete(`/admin/ad/${id}`)
}
