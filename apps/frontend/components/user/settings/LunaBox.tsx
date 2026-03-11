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
import { Moon } from 'lucide-react'
import { useLunaBoxStore } from '@/store/localSettingsStore'
import { Link } from '@/i18n/navigation'
import { FadeImage } from '@/components/common/shared/FadeImage'

export const LunaBoxSettings = () => {
  const t = useTranslations('Components.User.Settings.LunaBox')
  const showLunaBox = useLunaBoxStore(state => state.showLunaBox)
  const setShowLunaBox = useLunaBoxStore(state => state.setShowLunaBox)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-card-foreground">
          {t('description')}{' '}
          <Link href="/docs/guides/lunabox" className="underline text-primary">
            {t('learnMore')}
          </Link>
        </CardDescription>
        <CardAction>
          <FadeImage src="/assets/images/lunabox/lunabox.webp" alt="LunaBox" className="size-12" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Switch
            id="show-lunabox"
            checked={showLunaBox}
            onCheckedChange={checked => setShowLunaBox(!!checked)}
          />
          <Label htmlFor="show-lunabox">{t('showButton')}</Label>
        </div>
      </CardContent>
    </Card>
  )
}
