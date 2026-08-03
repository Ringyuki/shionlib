'use client'

import { useTranslations } from 'next-intl'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/shionui/Card'
import { Switch } from '@/components/shionui/animated/Switch'
import { Label } from '@/components/shionui/Label'
import { useReinaStore } from '@/store/localSettingsStore'
import { FadeImage } from '@/components/common/shared/FadeImage'

export const ReinaSettings = () => {
  const t = useTranslations('Components.User.Settings.Reina')
  const showReina = useReinaStore(state => state.showReina)
  const setShowReina = useReinaStore(state => state.setShowReina)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
        <CardAction>
          <FadeImage
            src="/assets/images/reina/reina.webp"
            alt="ReinaManager"
            className="size-12"
            sizes="48px"
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Switch
            id="show-reina"
            checked={showReina}
            onCheckedChange={checked => setShowReina(!!checked)}
          />
          <Label htmlFor="show-reina">{t('showButton')}</Label>
        </div>
      </CardContent>
    </Card>
  )
}
