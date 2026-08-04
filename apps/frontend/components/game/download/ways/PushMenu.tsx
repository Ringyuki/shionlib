import { Popover, PopoverTrigger, PopoverContent } from '@/components/shionui/Popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/shionui/Tooltip'
import { Button } from '@/components/shionui/Button'
import { Link } from '@/i18n/navigation'
import { LoaderCircle, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ReactNode } from 'react'

interface PushMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loading: boolean
  children: ReactNode
}

export const PushMenu = ({ open, onOpenChange, loading, children }: PushMenuProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadFileItem')

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              intent="primary"
              appearance="soft"
              size="icon"
              className="size-8"
              loading={loading}
              renderIcon={<Send />}
              aria-label={t('push')}
            />
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <span>{t('push')}</span>
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={8} className="z-60 w-70 p-1.5">
        <p className="px-2 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">
          {t('pushMenuTitle')}
        </p>
        <div className="flex flex-col gap-0.5">{children}</div>
      </PopoverContent>
    </Popover>
  )
}

interface PushMenuItemProps {
  icon: ReactNode
  title: string
  description: string
  loading?: boolean
  disabled?: boolean
  onSelect: () => void
  action?: {
    href: string
    icon: ReactNode
    label: string
  }
}

export const PushMenuItem = ({
  icon,
  title,
  description,
  loading = false,
  disabled = false,
  onSelect,
  action,
}: PushMenuItemProps) => {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={onSelect}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md p-2 text-left outline-none transition-colors hover:bg-secondary focus-visible:bg-secondary disabled:pointer-events-none disabled:opacity-50"
      >
        <span className="flex size-7 shrink-0 items-center justify-center">{icon}</span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm leading-none font-medium">{title}</span>
          <span className="text-xs leading-snug text-muted-foreground">{description}</span>
        </span>
      </button>
      <span className="flex size-7 shrink-0 items-center justify-center">
        {loading ? (
          <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" />
        ) : action ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={action.href}
                aria-label={action.label}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {action.icon}
              </Link>
            </TooltipTrigger>
            <TooltipContent className="z-80">
              <span>{action.label}</span>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </span>
    </div>
  )
}
