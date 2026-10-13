import { useEffect } from 'react'
import { readLocal, writeLocal } from '~/shared/storage/local-storage'
import { celebratedKey, celebrates, remembered, type Order } from './sponsor'
import { celebrate } from './sponsor-confetti'
import { celebratedFrom } from './sponsor.schema'

export function useCelebration(order: Pick<Order, 'id' | 'status' | 'paidAt'>) {
  const { id, status, paidAt } = order
  useEffect(() => {
    if (!celebrates({ status, paidAt }, new Date())) {
      return
    }
    const celebrated = readLocal(celebratedKey, celebratedFrom)
    if (celebrated.includes(id)) {
      return
    }
    writeLocal(celebratedKey, remembered(celebrated, id))
    void celebrate()
  }, [id, status, paidAt])
}
