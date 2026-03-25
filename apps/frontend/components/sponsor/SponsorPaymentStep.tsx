'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/shionui/Button'
import { Badge } from '@/components/shionui/Badge'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { PaymentMethodInfo } from '@/interfaces/sponsor/sponsor.interface'
import { METHOD_ICONS } from './constants/sponsor'

interface SponsorPaymentStepProps {
  paymentMethods: PaymentMethodInfo[]
  onSelect: (method: string) => void
  onBack: () => void
  loading: boolean
}

export const SponsorPaymentStep = ({
  paymentMethods,
  onSelect,
  onBack,
  loading,
}: SponsorPaymentStepProps) => {
  const t = useTranslations('Components.Sponsor.SponsorModal')
  const [selected, setSelected] = useState<string | null>(null)

  const getMethodLabel = (pm: PaymentMethodInfo) => {
    const key = pm.method
    try {
      return t(key)
    } catch {
      return pm.name
    }
  }

  const handleSubmit = () => {
    if (!selected) return
    onSelect(selected)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">{t('payment-title')}</p>
      <div className="grid grid-cols-3 gap-2">
        {paymentMethods.map(pm => {
          const isSelected = selected === pm.method
          const hasFee = (pm.ratioRange && pm.ratioRange !== '0%') || pm.fixedFeeRange
          return (
            <button
              key={pm.method}
              type="button"
              onClick={() => setSelected(pm.method)}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 rounded-lg border px-3 py-6 transition-colors cursor-pointer',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50',
              )}
            >
              <span className="text-xl">{METHOD_ICONS[pm.method] ?? null}</span>
              <span className="text-xs font-medium leading-tight text-center">
                {getMethodLabel(pm)}
              </span>
              {hasFee && (
                <span className="flex flex-wrap items-center justify-center gap-1">
                  {pm.ratioRange && pm.ratioRange !== '0%' && (
                    <Badge
                      appearance="soft"
                      size="sm"
                      intent="info"
                      className="text-[10px] px-1 py-0"
                    >
                      {pm.ratioRange}
                    </Badge>
                  )}
                  {pm.fixedFeeRange && (
                    <Badge
                      appearance="soft"
                      size="sm"
                      intent="warning"
                      className="text-[10px] px-1 py-0"
                    >
                      +{pm.fixedFeeRange}
                    </Badge>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <Button appearance="outline" onClick={onBack} disabled={loading} renderIcon={<ArrowLeft />}>
          {t('back')}
        </Button>
        <Button className="flex-1" onClick={handleSubmit} disabled={!selected} loading={loading}>
          {t('next')}
        </Button>
      </div>
    </div>
  )
}
