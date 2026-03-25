'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMedia } from 'react-use'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, ExternalLink, Loader2, Clock } from 'lucide-react'
import { Button } from '@/components/shionui/Button'
import Counter from '@/components/shionui/Counter'
import { shionlibRequest } from '@/utils/request'
import type { SponsorOrderStatus } from '@/interfaces/sponsor/sponsor.interface'
import { POLL_INTERVAL, MAX_POLLS } from './constants/sponsor'
import Link from 'next/link'

interface SponsorQRCodeStepProps {
  payUrl: string
  orderId: number
  payCurrency: string | null
  payAmount: number | null
  expiresAt: string | null
  onStatusChange: (status: SponsorOrderStatus['status']) => void
  onBack: () => void
}

export const SponsorQRCodeStep = ({
  payUrl,
  orderId,
  payCurrency,
  payAmount,
  expiresAt,
  onStatusChange,
  onBack,
}: SponsorQRCodeStepProps) => {
  const t = useTranslations('Components.Sponsor.SponsorModal')
  const isMobile = useMedia('(max-width: 768px)', false)
  const pollCountRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() => {
    if (!expiresAt) return null
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  })

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isMobile && payUrl) {
      window.open(payUrl, '_blank')
    }
  }, [isMobile, payUrl])

  useEffect(() => {
    pollCountRef.current = 0
    const poll = async () => {
      if (pollCountRef.current >= MAX_POLLS) {
        stopPolling()
        return
      }
      pollCountRef.current++
      try {
        const res = await shionlibRequest().get<SponsorOrderStatus>(`/sponsor/order/${orderId}`)
        if (res.data && res.data.status !== 'NEW') {
          stopPolling()
          onStatusChange(res.data.status)
        }
      } catch {
        // continue polling
      }
    }

    intervalRef.current = setInterval(poll, POLL_INTERVAL)

    return stopPolling
  }, [orderId, onStatusChange, stopPolling])

  useEffect(() => {
    if (!remainingSeconds) return
    countdownRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        if (!prev || prev <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [remainingSeconds])

  const minutes = remainingSeconds ? Math.floor(remainingSeconds / 60) : 0
  const seconds = remainingSeconds ? remainingSeconds % 60 : 0

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="text-sm font-medium">{t('paying-title')}</p>
      {!isMobile && (
        <div className="rounded-xl border bg-white p-4">
          <QRCodeSVG value={payUrl} size={200} />
        </div>
      )}
      {isMobile ? (
        <p className="text-xs text-muted-foreground">{t('open-in-browser-to-pay')}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{t('scan-qrcode')}</p>
      )}

      {payCurrency && !!payAmount && payAmount > 0 && (
        <p className="text-lg font-semibold">
          {payCurrency} {payAmount}
        </p>
      )}

      {!!remainingSeconds && (
        <span className="flex items-center tabular-nums text-sm font-medium">
          <Counter
            value={minutes}
            fontSize={14}
            padding={0}
            gap={0}
            horizontalPadding={0}
            gradientHeight={0}
          />
          <span>:</span>
          <Counter
            value={seconds}
            fontSize={14}
            padding={0}
            gap={0}
            horizontalPadding={0}
            gradientHeight={0}
            places={[10, 1]}
          />
        </span>
      )}

      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        <span className="text-xs">{t('waiting-payment')}</span>
      </div>

      <div className="flex items-center gap-3">
        <Button
          appearance="ghost"
          intent="neutral"
          size="xs"
          onClick={() => {
            stopPolling()
            onBack()
          }}
          renderIcon={<ArrowLeft />}
          className="text-xs"
        >
          {t('change-payment')}
        </Button>
        <Link href={payUrl} target="_blank" rel="noopener noreferrer">
          <Button appearance="ghost" size="xs" renderIcon={<ExternalLink />} className="text-xs">
            {t('open-in-browser')}
          </Button>
        </Link>
      </div>
    </div>
  )
}
