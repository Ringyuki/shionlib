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
  getAdminReportDetail,
  reviewAdminReport,
  useAdminReportList,
} from '../../../../components/admin/hooks/useAdminReports'

describe('components/admin/hooks/useAdminReports (unit)', () => {
  beforeEach(() => {
    hoisted.get.mockReset()
    hoisted.post.mockReset()
    hoisted.patch.mockReset()
    hoisted.put.mockReset()
    hoisted.del.mockReset()
    hoisted.requestFactory.mockClear()
  })

  it('fetches report list with full filters', async () => {
    const payload = { items: [], page: 1, pageSize: 20, total: 0 }
    hoisted.get.mockResolvedValue({ data: payload })

    const { result } = renderHook(() =>
      useAdminReportList({
        page: 1,
        limit: 20,
        status: 'OPEN',
        reason: 'MALWARE',
        malicious_level: 'HIGH',
        resource_id: 2,
        reporter_id: 3,
        reported_user_id: 4,
        sortBy: 'created',
        sortOrder: 'DESC',
      } as any),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(hoisted.get).toHaveBeenCalledWith(
      '/admin/content/download-resource-reports?page=1&pageSize=20&status=OPEN&reason=MALWARE&malicious_level=HIGH&resource_id=2&reporter_id=3&reported_user_id=4&sortBy=created&sortOrder=DESC',
    )
    expect(result.current.data).toEqual(payload)
  })

  it('calls detail and review endpoints', async () => {
    hoisted.get.mockResolvedValue({ data: { id: 5 } })
    hoisted.patch.mockResolvedValue({ data: { id: 5, verdict: 'VALID' } })

    await expect(getAdminReportDetail(5)).resolves.toEqual({ id: 5 })
    await expect(reviewAdminReport(5, { verdict: 'VALID' as any, notify: true })).resolves.toEqual({
      id: 5,
      verdict: 'VALID',
    })

    expect(hoisted.get).toHaveBeenCalledWith('/admin/content/download-resource-reports/5')
    expect(hoisted.patch).toHaveBeenCalledWith(
      '/admin/content/download-resource-reports/5/review',
      {
        data: { verdict: 'VALID', notify: true },
      },
    )
  })
})
