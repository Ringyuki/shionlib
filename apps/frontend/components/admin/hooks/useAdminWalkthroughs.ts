'use client'

import { useCallback, useEffect, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import {
  AdminWalkthroughDetail,
  AdminWalkthroughItem,
  AdminWalkthroughListQuery,
  AdminWalkthroughStatus,
} from '@/interfaces/admin/walkthrough.interface'

export function useAdminWalkthroughList(query: AdminWalkthroughListQuery = {}) {
  const [data, setData] = useState<PaginatedResponse<AdminWalkthroughItem> | null>(null)
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
      if (query.status) params.set('status', query.status)
      if (query.creatorId !== undefined) params.set('creatorId', query.creatorId.toString())
      if (query.gameId !== undefined) params.set('gameId', query.gameId.toString())

      const queryString = params.toString()
      const url = `/admin/walkthroughs${queryString ? `?${queryString}` : ''}`
      const res = await shionlibRequest().get<PaginatedResponse<AdminWalkthroughItem>>(url)
      setData(res.data)
    } catch (error) {
      console.error('Failed to fetch walkthrough list:', error)
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
    query.status,
    query.creatorId,
    query.gameId,
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, refetch: fetchData }
}

export async function getAdminWalkthroughDetail(id: number): Promise<AdminWalkthroughDetail> {
  const res = await shionlibRequest().get<AdminWalkthroughDetail>(`/admin/walkthroughs/${id}`)
  return res.data as AdminWalkthroughDetail
}

export async function updateAdminWalkthroughStatus(
  id: number,
  data: {
    status: AdminWalkthroughStatus
  },
) {
  await shionlibRequest().patch(`/admin/walkthroughs/${id}/status`, { data })
}

export async function rescanAdminWalkthrough(id: number) {
  await shionlibRequest().post(`/admin/walkthroughs/${id}/rescan`)
}
