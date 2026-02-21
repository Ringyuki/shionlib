'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'

export function ForceScrollTop() {
  const { id } = useParams<{ id: string }>()

  useEffect(() => {
    if (window.location.hash) return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [id])

  return null
}
