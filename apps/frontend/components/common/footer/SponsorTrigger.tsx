'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Heart } from 'lucide-react'
import { SponsorModal } from '@/components/sponsor/SponsorModal'

export const SponsorTrigger = () => {
  const t = useTranslations('Components.Common.Footer.ShionlibFooter')
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 hover:opacity-80 transition-opacity text-sm cursor-pointer"
      >
        <Heart className="size-3 text-destructive fill-destructive" />
        {t('sponsor')}
      </button>
      <SponsorModal open={open} onOpenChange={setOpen} />
    </>
  )
}
