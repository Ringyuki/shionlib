import { Link } from '@/i18n/navigation'
import { cn } from '@/utils/cn'

interface SiteLogoProps {
  size?: 'sm' | 'base' | 'lg' | 'xl' | number | string
  className?: string
  link?: boolean
}

interface ContentProps {
  size?: 'sm' | 'base' | 'lg' | 'xl' | number | string
  className?: string
}

const Content = ({ size, className }: ContentProps) => {
  return (
    <span
      className={cn(
        'text-2xl text-primary dark:text-primary-foreground font-bold select-none',
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
  )
}

export const SiteLogo = ({ size, className, link = true }: SiteLogoProps) => {
  return link ? (
    <Link href="/" className="flex items-center h-full pl-0">
      <Content size={size} className={className} />
    </Link>
  ) : (
    <Content size={size} className={className} />
  )
}
