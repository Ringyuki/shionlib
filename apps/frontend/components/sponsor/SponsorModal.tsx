'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/shionui/Modal'
import { shionlibRequest } from '@/utils/request'
import type {
  CreateSponsorOrderRes,
  PaySponsorOrderRes,
  SponsorOrderStatus,
} from '@/interfaces/sponsor/sponsor.interface'
import { useSponsorDialogStore } from '@/store/sponsorDialogStore'
import { SponsorAmountStep } from './SponsorAmountStep'
import { SponsorPaymentStep } from './SponsorPaymentStep'
import { SponsorQRCodeStep } from './SponsorQRCodeStep'
import { SponsorResultStep } from './SponsorResultStep'
import { Heart } from 'lucide-react'

interface SponsorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const SponsorModal = ({ open, onOpenChange }: SponsorModalProps) => {
  const t = useTranslations('Components.Sponsor.SponsorModal')
  const {
    step,
    orderId,
    paymentMethods,
    payUrl,
    payCurrency,
    payAmount,
    expiresAt,
    setOrderCreated,
    setPaymentInitiated,
    setStep,
    resetOrder,
  } = useSponsorDialogStore()

  const [loading, setLoading] = useState(false)
  const [finalStatus, setFinalStatus] = useState<SponsorOrderStatus['status']>('NEW')

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      setLoading(false)
      setFinalStatus('NEW')
      if (step === 'result') {
        resetOrder()
      }
    }
    onOpenChange(value)
  }

  const handleAmountNext = async (data: {
    amount: number
    name: string
    message: string
    isPrivate: boolean
  }) => {
    setLoading(true)
    try {
      const res = await shionlibRequest().post<CreateSponsorOrderRes>('/sponsor/order', {
        data: {
          amount: data.amount,
          name: data.name || undefined,
          message: data.message || undefined,
          isPrivate: data.isPrivate,
        },
      })
      setOrderCreated({
        orderId: res.data?.orderId ?? 0,
        paymentMethods: res.data?.paymentMethods ?? [],
        expiresAt: res.data?.expiresAt ?? null,
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSelect = async (method: string) => {
    if (!orderId) return
    setLoading(true)
    try {
      const res = await shionlibRequest().post<PaySponsorOrderRes>(
        `/sponsor/order/${orderId}/pay`,
        { data: { method } },
      )
      setPaymentInitiated({
        payUrl: res.data?.payUrl ?? '',
        payCurrency: res.data?.payCurrency ?? null,
        payAmount: res.data?.amount ?? null,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = useCallback(
    (status: SponsorOrderStatus['status']) => {
      setFinalStatus(status)
      setStep('result')
    },
    [setStep],
  )

  const title =
    step === 'result' ? undefined : (
      <span className="flex gap-2 items-center">
        {t('title')}
        <Heart className="size-5 text-destructive fill-destructive" />
      </span>
    )

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={t('description')}
      closable
    >
      {step === 'amount' && <SponsorAmountStep onNext={handleAmountNext} loading={loading} />}
      {step === 'payment' && (
        <SponsorPaymentStep
          paymentMethods={paymentMethods}
          onSelect={handlePaymentSelect}
          onBack={resetOrder}
          loading={loading}
        />
      )}
      {step === 'qrcode' && orderId && (
        <SponsorQRCodeStep
          payUrl={payUrl}
          orderId={orderId}
          payCurrency={payCurrency}
          payAmount={payAmount}
          expiresAt={expiresAt}
          onStatusChange={handleStatusChange}
          onBack={() => setStep('payment')}
        />
      )}
      {step === 'result' && (
        <SponsorResultStep
          status={finalStatus}
          onClose={() => handleOpenChange(false)}
          onRetry={resetOrder}
        />
      )}
    </Modal>
  )
}
