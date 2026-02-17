'use client'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
  CardContent,
} from '@/components/shionui/Card'
import { useShionlibUserStore } from '@/store/userStore'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from '@/components/shionui/Select'
import { usePathname, useRouter } from '@/i18n/navigation.client'
import { useLocale } from 'next-intl'
import { Languages } from 'lucide-react'
import { Button } from '@/components/shionui/Button'
import { SupportedLocales } from '@/config/i18n/supported'
import { sileo } from 'sileo'

interface LanguageSettingsProps {
  initialLanguage: SupportedLocales
}

export const LanguageSettings = ({ initialLanguage }: LanguageSettingsProps) => {
  const t = useTranslations('Components.User.Settings.Language')
  const [language, setLanguage] = useState<SupportedLocales>(initialLanguage)
  const [isUpdating, setIsUpdating] = useState(false)
  const { updateUser } = useShionlibUserStore()
  const router = useRouter()
  const pathname = usePathname()
  const locale = useLocale()

  const handleUpdate = async () => {
    try {
      setIsUpdating(true)
      await shionlibRequest().post('/user/info/lang', {
        data: { lang: language },
      })
      updateUser({ lang: language })
      const targetLocale = language
      sileo.success({ title: t('success') })
      if (targetLocale === locale) return
      router.replace(pathname, { locale: targetLocale })
    } catch {
    } finally {
      setIsUpdating(false)
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
        <CardAction>
          <Languages className="size-12 text-purple-600" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Select value={language} onValueChange={value => setLanguage(value as SupportedLocales)}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectLanguage')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t('chooseLanguage')}</SelectLabel>
              <SelectItem value="ja">日本語</SelectItem>
              <SelectItem value="zh">简体中文</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </CardContent>
      <CardFooter>
        <Button intent="primary" onClick={handleUpdate} loading={isUpdating}>
          {t('update')}
        </Button>
      </CardFooter>
    </Card>
  )
}
