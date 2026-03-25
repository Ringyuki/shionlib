'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/shionui/Button'
import { CircleX, RotateCcw, Heart } from 'lucide-react'
import type { SponsorOrderStatus } from '@/interfaces/sponsor/sponsor.interface'

interface SponsorResultStepProps {
  status: SponsorOrderStatus['status']
  onClose: () => void
  onRetry: () => void
}

export const SponsorResultStep = ({ status, onClose, onRetry }: SponsorResultStepProps) => {
  const t = useTranslations('Components.Sponsor.SponsorModal')

  const isSuccess = status === 'DONE'

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {isSuccess ? (
        <Heart className="size-12 text-destructive fill-destructive" />
      ) : (
        <CircleX className="size-12 text-destructive" />
      )}

      <div className="text-center space-y-1">
        <p className="text-lg font-semibold">
          {isSuccess
            ? t('success-title')
            : status === 'REFUND'
              ? t('refund-title')
              : t('expired-title')}
        </p>
        <p className="text-sm text-muted-foreground">
          {isSuccess
            ? t('success-message')
            : status === 'REFUND'
              ? t('refund-message')
              : t('expired-message')}
        </p>
      </div>

      <div className="flex gap-2">
        {!isSuccess && (
          <Button appearance="outline" onClick={onRetry} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            {t('retry')}
          </Button>
        )}
        <Button onClick={onClose}>{t('close')}</Button>
      </div>
    </div>
  )
}
