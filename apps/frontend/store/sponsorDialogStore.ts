import { create } from 'zustand'
import type { PaymentMethodInfo } from '@/interfaces/sponsor/sponsor.interface'

type SponsorStep = 'amount' | 'payment' | 'qrcode' | 'result'

const initialOrderState = {
  step: 'amount' as const,
  orderId: null,
  paymentMethods: [],
  payUrl: '',
  payCurrency: null,
  payAmount: null,
  expiresAt: null,
}

interface SponsorDialogState {
  sponsorDialogOpen: boolean
  step: SponsorStep
  orderId: number | null
  paymentMethods: PaymentMethodInfo[]
  payUrl: string
  payCurrency: string | null
  payAmount: number | null
  expiresAt: string | null

  openSponsorDialog: () => void
  closeSponsorDialog: () => void
  setOrderCreated: (data: {
    orderId: number
    paymentMethods: PaymentMethodInfo[]
    expiresAt: string | null
  }) => void
  setPaymentInitiated: (data: {
    payUrl: string
    payCurrency: string | null
    payAmount: number | null
  }) => void
  setStep: (step: SponsorStep) => void
  resetOrder: () => void
}

export const useSponsorDialogStore = create<SponsorDialogState>()(set => ({
  sponsorDialogOpen: false,
  ...initialOrderState,

  openSponsorDialog: () =>
    set(state => {
      // If pending order has expired, reset to amount step
      if (state.orderId && state.expiresAt && new Date(state.expiresAt).getTime() < Date.now()) {
        return { ...initialOrderState, sponsorDialogOpen: true }
      }
      return { sponsorDialogOpen: true }
    }),
  closeSponsorDialog: () => set({ sponsorDialogOpen: false }),

  setOrderCreated: data =>
    set({
      step: 'payment',
      orderId: data.orderId,
      paymentMethods: data.paymentMethods,
      expiresAt: data.expiresAt,
      payUrl: '',
      payCurrency: null,
      payAmount: null,
    }),
  setPaymentInitiated: data =>
    set({
      step: 'qrcode',
      payUrl: data.payUrl,
      payCurrency: data.payCurrency,
      payAmount: data.payAmount,
    }),
  setStep: step => set({ step }),
  resetOrder: () => set(initialOrderState),
}))
