'use client'

import { useTranslations } from 'next-intl'
import { Modal } from '@/components/shionui/Modal'
import { Button } from '@/components/shionui/Button'
import { useSponsorDialogStore } from '@/store/sponsorDialogStore'
import { useAdFreeDialogStore } from '@/store/adFreeDialogStore'

export const AdFreeModal = () => {
  const t = useTranslations('Components.Common.Site.Ad')
  const { adFreeDialogOpen: open, closeAdFreeDialog } = useAdFreeDialogStore()
  const { openSponsorDialog } = useSponsorDialogStore()

  const onOpenChange = (v: boolean) => {
    if (!v) closeAdFreeDialog()
  }

  const handleSponsor = () => {
    closeAdFreeDialog()
    openSponsorDialog()
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('ad-free-title')}
      closable
      footer={
        <Button onClick={handleSponsor} loginRequired>
          {t('sponsor-cta')}
        </Button>
      }
      description={t('ad-free-description')}
    >
      {t('ad-free-pricing')}
    </Modal>
  )
}
