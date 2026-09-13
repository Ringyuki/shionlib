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
import { usePotatoVNStore } from '@/store/localSettingsStore'
import { Link } from '@/i18n/navigation'
import { FadeImage } from '@/components/common/shared/FadeImage'

export const PotatoVNSettings = () => {
  const t = useTranslations('Components.User.Settings.PotatoVN')
  const showPotatoVN = usePotatoVNStore(state => state.showPotatoVN)
  const setShowPotatoVN = usePotatoVNStore(state => state.setShowPotatoVN)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-card-foreground">
          {t('description')}{' '}
          <Link href="/docs/guides/potatovn-download" className="underline text-primary">
            {t('learnMore')}
          </Link>
        </CardDescription>
        <CardAction>
          <FadeImage
            src="/assets/images/potatovn/potatovn.webp"
            alt="PotatoVN"
            className="size-12"
            sizes="48px"
          />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Switch
            id="show-potatovn"
            checked={showPotatoVN}
            onCheckedChange={checked => setShowPotatoVN(!!checked)}
          />
          <Label htmlFor="show-potatovn">{t('showButton')}</Label>
        </div>
      </CardContent>
    </Card>
  )
}
