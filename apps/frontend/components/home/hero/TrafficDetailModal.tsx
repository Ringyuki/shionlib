'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/shionui/Modal'
import { shionlibRequest } from '@/utils/request'
import type { TrafficDetailData } from '@/interfaces/analysis/data.interface'
import { TrafficDetailSkeleton } from './traffic-detail/TrafficDetailSkeleton'
import { SummaryCards } from './traffic-detail/SummaryCards'
import { HourlyTrendChart } from './traffic-detail/HourlyTrendChart'
import { TopFilesChart } from './traffic-detail/TopFilesChart'

interface TrafficDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const TrafficDetailModal = ({ open, onOpenChange }: TrafficDetailModalProps) => {
  const t = useTranslations('Components.Home.Hero.Overview')
  const [data, setData] = useState<TrafficDetailData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    const start = performance.now()
    shionlibRequest()
      .get<TrafficDetailData>('/analysis/data/traffic-detail')
      .then(res => {
        const delay = Math.max(0, 500 - (performance.now() - start))
        setTimeout(() => {
          setData(res.data)
          setLoading(false)
        }, delay)
      })
      .catch(() => {
        setData(null)
        setLoading(false)
      })
  }, [open])

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('modal-title')}
      dialogClassName="max-w-4xl!"
    >
      {loading ? (
        <TrafficDetailSkeleton />
      ) : !data || (data.totalDownloads === 0 && data.topFiles.length === 0) ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-muted-foreground">{t('no-data')}</p>
        </div>
      ) : (
        <div className="space-y-5">
          <SummaryCards
            data={data}
            labels={{
              totalDownloads: t('total-downloads'),
              totalTraffic: t('total-traffic'),
              averageSize: t('average-size'),
            }}
          />

          {data.hourly.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t('hourly-trend')}</h4>
              <HourlyTrendChart data={data.hourly} trafficLabel={t('traffic')} />
            </div>
          )}

          {data.topFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">{t('top-files')}</h4>
              <TopFilesChart data={data.topFiles} trafficLabel={t('traffic')} />
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
