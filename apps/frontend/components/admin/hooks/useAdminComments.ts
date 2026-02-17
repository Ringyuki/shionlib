'use client'

import { useCallback, useEffect, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import {
  AdminCommentItem,
  AdminCommentDetail,
  AdminCommentListQuery,
} from '@/interfaces/admin/comment.interface'

export function useAdminCommentList(query: AdminCommentListQuery = {}) {
  const [data, setData] = useState<PaginatedResponse<AdminCommentItem> | null>(null)
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
      if (query.status !== undefined) params.set('status', query.status.toString())
      if (query.creatorId !== undefined) params.set('creatorId', query.creatorId.toString())
      if (query.gameId !== undefined) params.set('gameId', query.gameId.toString())

      const queryString = params.toString()
      const url = `/admin/comments${queryString ? `?${queryString}` : ''}`
      const res = await shionlibRequest().get<PaginatedResponse<AdminCommentItem>>(url)
      setData(res.data)
    } catch (error) {
      console.error('Failed to fetch comment list:', error)
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

export async function getAdminCommentDetail(id: number): Promise<AdminCommentDetail> {
  const res = await shionlibRequest().get<AdminCommentDetail>(`/admin/comments/${id}`)
  return res.data as AdminCommentDetail
}

export async function updateAdminCommentStatus(
  id: number,
  data: {
    status: number
    notify?: boolean
    top_category?: string
    reason?: string
    evidence?: string
  },
) {
  await shionlibRequest().patch(`/admin/comments/${id}/status`, { data })
}

export async function rescanAdminComment(id: number) {
  await shionlibRequest().post(`/admin/comments/${id}/rescan`)
}
