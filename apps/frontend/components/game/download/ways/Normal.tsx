import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/shionui/Tooltip'
import { Button } from '@/components/shionui/Button'
import { Globe } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface NormalProps {
  normalDownloadLoading: boolean
  handleNormalDownload: () => void
}

export const Normal = ({ normalDownloadLoading, handleNormalDownload }: NormalProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadFileItem')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          intent="neutral"
          appearance="ghost"
          size="icon"
          className="size-8 text-secondary-foreground/50"
          loading={normalDownloadLoading}
          onClick={handleNormalDownload}
          renderIcon={<Globe />}
        />
      </TooltipTrigger>
      <TooltipContent>
        <span>{t('normalDownload')}</span>
      </TooltipContent>
    </Tooltip>
  )
}
