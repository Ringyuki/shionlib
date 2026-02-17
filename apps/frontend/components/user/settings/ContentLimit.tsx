'use client'

import { ContentLimit as ContentLimitEnum } from '@/interfaces/user/user.interface'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from '@/components/shionui/Select'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from '@/components/shionui/Card'
import { Button } from '@/components/shionui/Button'
import { Alert, AlertTitle, AlertDescription } from '@/components/shionui/Alert'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { VenusAndMars } from 'lucide-react'
import { useShionlibUserStore } from '@/store/userStore'
import { useAuthDialogStore } from '@/store/authDialogStore'

interface ContentLimitProps {
  initialContentLimit: ContentLimitEnum
}

export const ContentLimit = ({ initialContentLimit }: ContentLimitProps) => {
  const t = useTranslations('Components.User.Settings.ContentLimit')
  const [contentLimit, setContentLimit] = useState<ContentLimitEnum>(initialContentLimit)
  const [isUpdating, setIsUpdating] = useState(false)
  const { logout } = useShionlibUserStore()
  const { openAuthDialog } = useAuthDialogStore()
  const relogin = () => {
    void logout().catch(() => {})
    openAuthDialog()
  }

  const handleUpdate = async () => {
    try {
      setIsUpdating(true)
      await shionlibRequest().post('/user/info/content-limit', {
        data: { content_limit: Number(contentLimit) },
      })
      // toast.success(t('success'))
      sileo.success({
        title: t('success'),
        description: t('tipsDescription'),
        styles: {
          description: 'dark:text-background',
        },
        button: { title: t('relogin'), onClick: relogin },
      })
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
          <VenusAndMars className="size-12 text-pink-600" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Select
          value={contentLimit.toString()}
          onValueChange={value => setContentLimit(value as unknown as ContentLimitEnum)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('selectContentLimit')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t('chooseContentLimit')}</SelectLabel>
              <SelectItem value={ContentLimitEnum.SHOW_WITH_SPOILER.toString()}>
                {t('showWithSpoiler')}
              </SelectItem>
              <SelectItem value={ContentLimitEnum.JUST_SHOW.toString()}>{t('justShow')}</SelectItem>
              <SelectItem value={ContentLimitEnum.NEVER_SHOW_NSFW_CONTENT.toString()}>
                {t('neverShowNsfwContent')}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Alert intent="info" appearance="soft" size="sm">
          <AlertTitle className="text-base">{t('tipsTitle')}</AlertTitle>
          <AlertDescription>{t('tipsDescription')}</AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter>
        <Button intent="primary" onClick={handleUpdate} loading={isUpdating}>
          {t('update')}
        </Button>
      </CardFooter>
    </Card>
  )
}
