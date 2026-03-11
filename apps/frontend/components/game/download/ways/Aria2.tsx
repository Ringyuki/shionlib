import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/shionui/Tooltip'
import { Button } from '@/components/shionui/Button'
import { CloudLightning } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Aria2Props {
  pushToAria2Loading: boolean
  handlePushToAria2: () => void
}

export const Aria2 = ({ pushToAria2Loading, handlePushToAria2 }: Aria2Props) => {
  const t = useTranslations('Components.Game.Download.GameDownloadFileItem')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          intent="primary"
          appearance="soft"
          size="icon"
          className="size-8"
          loading={pushToAria2Loading}
          onClick={handlePushToAria2}
          renderIcon={<CloudLightning />}
        />
      </TooltipTrigger>
      <TooltipContent>
        <span>{t('pushToAria2')}</span>
      </TooltipContent>
    </Tooltip>
  )
}
