import { useTranslations } from 'next-intl'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { PushMenuItem } from './PushMenu'

interface ReinaProps {
  reinaLoading: boolean
  handleReina: () => void
  disabled: boolean
}

export const Reina = ({ reinaLoading, handleReina, disabled }: ReinaProps) => {
  const t = useTranslations('Components.Game.Download.GameDownloadFileItem')

  return (
    <PushMenuItem
      icon={
        <FadeImage
          src="/assets/images/reina/reina.webp"
          alt="ReinaManager"
          className="size-7 rounded-md"
          sizes="28px"
        />
      }
      title={t('reinaName')}
      description={disabled ? t('reinaUnavailable') : t('reinaDescription')}
      loading={reinaLoading}
      disabled={disabled}
      onSelect={handleReina}
    />
  )
}
