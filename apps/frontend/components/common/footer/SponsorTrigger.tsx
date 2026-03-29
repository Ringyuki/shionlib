'use client'

import { useTranslations } from 'next-intl'
import { Heart } from 'lucide-react'
import { useSponsorDialogStore } from '@/store/sponsorDialogStore'

export const SponsorTrigger = () => {
  const t = useTranslations('Components.Common.Footer.ShionlibFooter')
  const { openSponsorDialog } = useSponsorDialogStore()

  return (
    <button
      type="button"
      onClick={openSponsorDialog}
      className="flex items-center gap-1 hover:opacity-80 transition-opacity text-sm cursor-pointer"
    >
      <Heart className="size-3 text-destructive fill-destructive" />
      {t('sponsor')}
    </button>
  )
}
