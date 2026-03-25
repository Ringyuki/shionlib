'use client'

import { useCallback, useEffect, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import {
  AdminSponsorOrderItem,
  AdminSponsorListQuery,
  AdminSponsorStats,
} from '@/interfaces/admin/sponsor.interface'

export function useAdminSponsorList(query: AdminSponsorListQuery = {}) {
  const [data, setData] = useState<PaginatedResponse<AdminSponsorOrderItem> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.page) params.set('page', query.page.toString())
      if (query.limit) params.set('pageSize', query.limit.toString())
      if (query.status) params.set('status', query.status)

      const queryString = params.toString()
      const url = `/admin/sponsor/orders${queryString ? `?${queryString}` : ''}`
      const res = await shionlibRequest().get<PaginatedResponse<AdminSponsorOrderItem>>(url)
      setData(res.data)
    } catch (error) {
      console.error('Failed to fetch sponsor list:', error)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [query.page, query.limit, query.status])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, refetch: fetchData }
}

export async function getAdminSponsorStats(): Promise<AdminSponsorStats> {
  const res = await shionlibRequest().get<AdminSponsorStats>('/admin/sponsor/stats')
  return res.data as AdminSponsorStats
}
