import { Link } from '@/i18n/navigation'
import { cn } from '@/utils/cn'

interface SiteLogoProps {
  size?: 'sm' | 'base' | 'lg' | 'xl' | number | string
  className?: string
}

export const SiteLogo = ({ size, className }: SiteLogoProps) => {
  return (
    <Link href="/" className="flex items-center h-full pl-0">
      <span
        className={cn(
          'text-2xl text-primary dark:text-primary-foreground font-bold select-none cursor-pointer',
          size === 'sm' && 'text-sm',
          size === 'base' && 'text-base',
          size === 'lg' && 'text-lg',
          size === 'xl' && 'text-xl',
          typeof size === 'number' && `text-[${size}px]`,
          className,
        )}
        style={{ fontFamily: 'var(--font-cinzel)' }}
      >
        Shionlib
      </span>
    </Link>
  )
}
