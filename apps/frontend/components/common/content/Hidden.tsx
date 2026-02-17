import { cn } from '@/utils/cn'
import { EyeOff } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface HiddenProps {
  vertical?: boolean
  className?: string
  iconClassName?: string
  textClassName?: string
  showIcon?: boolean
  showText?: boolean
}

export const Hidden = ({
  vertical,
  className,
  iconClassName,
  textClassName,
  showIcon = true,
  showText = true,
}: HiddenProps) => {
  const t = useTranslations('Components.Common.Content.Hidden')
  return (
    <div
      className={cn(
        'max-w-full max-h-full',
        vertical ? 'w-auto h-full' : 'w-full h-auto',
        'flex flex-col items-center justify-center gap-2',
        className,
      )}
    >
      {showIcon && <EyeOff className={cn('md:size-8 size-6 text-white', iconClassName)} />}
      {showText && <span className={cn('text-white text-sm', textClassName)}>{t('hidden')}</span>}
    </div>
  )
}
