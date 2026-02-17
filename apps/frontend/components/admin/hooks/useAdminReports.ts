'use client'

import { useCallback, useEffect, useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { PaginatedResponse } from '@/interfaces/api/shionlib-api-res.interface'
import {
  AdminDownloadResourceReportDetail,
  AdminDownloadResourceReportItem,
  AdminDownloadResourceReportListQuery,
  AdminDownloadResourceReportVerdict,
  AdminReportMaliciousLevel,
} from '@/interfaces/admin/report.interface'

export function useAdminReportList(query: AdminDownloadResourceReportListQuery = {}) {
  const [data, setData] = useState<PaginatedResponse<AdminDownloadResourceReportItem> | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (query.page) params.set('page', query.page.toString())
      if (query.limit) params.set('pageSize', query.limit.toString())
      if (query.status) params.set('status', query.status)
      if (query.reason) params.set('reason', query.reason)
      if (query.malicious_level) params.set('malicious_level', query.malicious_level)
      if (query.resource_id !== undefined) params.set('resource_id', query.resource_id.toString())
      if (query.reporter_id !== undefined) params.set('reporter_id', query.reporter_id.toString())
      if (query.reported_user_id !== undefined)
        params.set('reported_user_id', query.reported_user_id.toString())
      if (query.sortBy) params.set('sortBy', query.sortBy)
      if (query.sortOrder) params.set('sortOrder', query.sortOrder)

      const queryString = params.toString()
      const url = `/admin/content/download-resource-reports${queryString ? `?${queryString}` : ''}`
      const res =
        await shionlibRequest().get<PaginatedResponse<AdminDownloadResourceReportItem>>(url)
      setData(res.data)
    } catch (error) {
      console.error('Failed to fetch report list:', error)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [
    query.page,
    query.limit,
    query.status,
    query.reason,
    query.malicious_level,
    query.resource_id,
    query.reporter_id,
    query.reported_user_id,
    query.sortBy,
    query.sortOrder,
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, isLoading, refetch: fetchData }
}

export async function getAdminReportDetail(id: number): Promise<AdminDownloadResourceReportDetail> {
  const res = await shionlibRequest().get<AdminDownloadResourceReportDetail>(
    `/admin/content/download-resource-reports/${id}`,
  )
  return res.data as AdminDownloadResourceReportDetail
}

export async function reviewAdminReport(
  id: number,
  data: {
    verdict: AdminDownloadResourceReportVerdict
    malicious_level?: AdminReportMaliciousLevel
    process_note?: string
    notify?: boolean
  },
) {
  const res = await shionlibRequest().patch<AdminDownloadResourceReportDetail>(
    `/admin/content/download-resource-reports/${id}/review`,
    { data },
  )
  return res.data as AdminDownloadResourceReportDetail
}
