'use client'

import { shionlibRequest } from '@/utils/request'
import { useEffect } from 'react'
import { useParams } from 'next/navigation'

export const ViewPing = () => {
  const { id } = useParams()
  useEffect(() => {
    shionlibRequest().post<void>(`/game/${id}/view`, {
      options: {
        keepalive: true,
      },
    })
  }, [id])

  return null
}
