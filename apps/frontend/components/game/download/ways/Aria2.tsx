import { CloudLightning, Settings2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { PushMenuItem } from './PushMenu'

interface Aria2Props {
  pushToAria2Loading: boolean
  handlePushToAria2: () => void
}

export const Aria2 = ({ pushToAria2Loading, handlePushToAria2 }: Aria2Props) => {
  const t = useTranslations('Components.Game.Download.GameDownloadFileItem')

  return (
    <PushMenuItem
      icon={
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
          <CloudLightning className="size-4" />
        </span>
      }
      title={t('aria2Name')}
      description={t('aria2Description')}
      loading={pushToAria2Loading}
      onSelect={handlePushToAria2}
      action={{
        href: '/user/settings/download',
        icon: <Settings2 className="size-3.5" />,
        label: t('aria2SettingsLink'),
      }}
    />
  )
}
