import { Heart, CircleStar } from 'lucide-react'
import { cn } from '@/utils/cn'
import { SponsorModal } from '@/components/sponsor/SponsorModal'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shionui/Tooltip'
import { useState } from 'react'
import { useShionlibUserStore } from '@/store/userStore'
import { useTranslations } from 'next-intl'

interface SponsorBadgeProps {
  className?: string
  userId: number
}

export const SponsorBadge = ({ className, userId }: SponsorBadgeProps) => {
  const [open, setOpen] = useState(false)
  const { user } = useShionlibUserStore()
  const t = useTranslations('Components.Common.User.Sponsor')
  const isCurrentUser = user.id === userId
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              'absolute flex items-center justify-center transition-all cursor-pointer',
              !isCurrentUser && 'hover:brightness-90',
              className,
            )}
            style={{
              top: '85.36%',
              left: '85.36%',
              transform: 'translate(-50%, -50%)',
              width: 'clamp(14px, 36%, 26px)',
              height: 'clamp(14px, 36%, 26px)',
            }}
            onClick={e => {
              if (isCurrentUser) return
              e.preventDefault()
              e.stopPropagation()
              setOpen(true)
            }}
          >
            <CircleStar className="fill-primary text-white size-full" strokeWidth={1} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {t('tooltip')}
        </TooltipContent>
      </Tooltip>
      <SponsorModal open={open} onOpenChange={setOpen} />
    </>
  )
}
