import { FullscreenIcon } from 'lucide-react'
import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'
import { GradientIcon } from '@/components/shionui/GradientIcon'
import { GradientText } from '@/components/shionui/GradientText'
import { useSearchStore } from '@/store/searchStore'

export const AnimeTraceTrigger = () => {
  const t = useTranslations('Components.Common.Search.AnimeTrace.Trigger')
  const { closeSearchDialog, openAnimeTraceDialog } = useSearchStore()
  const handleClick = () => {
    closeSearchDialog()
    openAnimeTraceDialog()
  }
  return (
    <Button
      renderIcon={
        <GradientIcon icon={<FullscreenIcon />} gradientId="animetrace-trigger-gradient" />
      }
      appearance="ghost"
      intent="secondary"
      className="p-0 h-fit"
      showRipple={false}
      onClick={handleClick}
    >
      <GradientText text={t('trace')} />
    </Button>
  )
}
