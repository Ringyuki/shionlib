import { HelpCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { PushMenuItem } from './PushMenu'

interface PotatoVNProps {
  potatoVNLoading: boolean
  handlePotatoVN: () => void
  disabled: boolean
}

export const PotatoVN = ({ potatoVNLoading, handlePotatoVN, disabled }: PotatoVNProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadFileItem')

  return (
    <PushMenuItem
      icon={
        <FadeImage
          src="/assets/images/potatovn/potatovn.webp"
          alt="PotatoVN"
          className="size-7 rounded-md"
          sizes="28px"
        />
      }
      title={t('potatoVNName')}
      description={disabled ? t('potatoVNUnavailable') : t('potatoVNDescription')}
      loading={potatoVNLoading}
      disabled={disabled}
      onSelect={handlePotatoVN}
      action={{
        href: '/docs/guides/potatovn-download',
        icon: <HelpCircle className="size-3.5" />,
        label: t('potatoVNHelpLink'),
      }}
    />
  )
}
