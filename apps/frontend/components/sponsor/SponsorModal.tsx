'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Modal } from '@/components/shionui/Modal'
import { shionlibRequest } from '@/utils/request'
import type {
  CreateSponsorOrderRes,
  PaySponsorOrderRes,
  PaymentMethodInfo,
  SponsorOrderStatus,
} from '@/interfaces/sponsor/sponsor.interface'
import { SponsorAmountStep } from './SponsorAmountStep'
import { SponsorPaymentStep } from './SponsorPaymentStep'
import { SponsorQRCodeStep } from './SponsorQRCodeStep'
import { SponsorResultStep } from './SponsorResultStep'
import { Heart } from 'lucide-react'

type Step = 'amount' | 'payment' | 'qrcode' | 'result'

interface SponsorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const SponsorModal = ({ open, onOpenChange }: SponsorModalProps) => {
  const t = useTranslations('Components.Sponsor.SponsorModal')

  const [step, setStep] = useState<Step>('amount')
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState<number | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodInfo[]>([])
  const [payUrl, setPayUrl] = useState('')
  const [payCurrency, setPayCurrency] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState<number | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [finalStatus, setFinalStatus] = useState<SponsorOrderStatus['status']>('NEW')

  const reset = () => {
    setStep('amount')
    setLoading(false)
    setOrderId(null)
    setPaymentMethods([])
    setPayUrl('')
    setPayCurrency(null)
    setPayAmount(null)
    setExpiresAt(null)
    setFinalStatus('NEW')
  }

  const handleOpenChange = (value: boolean) => {
    if (!value) reset()
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
      setOrderId(res.data?.orderId ?? 0)
      setPaymentMethods(res.data?.paymentMethods ?? [])
      setExpiresAt(res.data?.expiresAt ?? null)
      setStep('payment')
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
      setPayUrl(res.data?.payUrl ?? '')
      setPayCurrency(res.data?.payCurrency ?? null)
      setPayAmount(res.data?.amount ?? null)
      setStep('qrcode')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = useCallback((status: SponsorOrderStatus['status']) => {
    setFinalStatus(status)
    setStep('result')
  }, [])

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
      closable={step === 'result' || step === 'amount'}
    >
      {step === 'amount' && <SponsorAmountStep onNext={handleAmountNext} loading={loading} />}
      {step === 'payment' && (
        <SponsorPaymentStep
          paymentMethods={paymentMethods}
          onSelect={handlePaymentSelect}
          onBack={() => setStep('amount')}
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
          onRetry={reset}
        />
      )}
    </Modal>
  )
}
