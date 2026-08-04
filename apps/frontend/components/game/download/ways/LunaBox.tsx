import { HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { PushMenuItem } from './PushMenu'

interface LunaBoxProps {
  lunaBoxLoading: boolean
  handleLunaBox: () => void
}

export const LunaBox = ({ lunaBoxLoading, handleLunaBox }: LunaBoxProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadFileItem')

  return (
    <PushMenuItem
      icon={
        <FadeImage
          src="/assets/images/lunabox/lunabox.webp"
          alt="LunaBox"
          className="size-7 rounded-md"
          sizes="28px"
        />
      }
      title={t('lunaBoxName')}
      description={t('lunaBoxDescription')}
      loading={lunaBoxLoading}
      onSelect={handleLunaBox}
      action={{
        href: '/docs/guides/lunabox',
        icon: <HelpCircle className="size-3.5" />,
        label: t('lunaBoxHelpLink'),
      }}
    />
  )
}
