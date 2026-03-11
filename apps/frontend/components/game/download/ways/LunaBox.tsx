import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/shionui/Tooltip'
import { Button } from '@/components/shionui/Button'
import { Moon, HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

interface LunaBoxProps {
  lunaBoxLoading: boolean
  handleLunaBox: () => void
}

export const LunaBox = ({ lunaBoxLoading, handleLunaBox }: LunaBoxProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadFileItem')

  return (
    <div className="md:block hidden">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            intent="neutral"
            appearance="soft"
            size="icon"
            className="size-8"
            loading={lunaBoxLoading}
            onClick={handleLunaBox}
            renderIcon={<Moon className="fill-current" />}
          />
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-1">
          <span>{t('pushToLunaBox')}</span>
          <Link href="/docs/guides/lunabox" className="inline-flex items-center">
            <HelpCircle className="size-3.5 text-current" />
          </Link>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}
