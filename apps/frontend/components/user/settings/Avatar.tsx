'use client'

import { User } from '@/interfaces/user/user.interface'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
} from '@/components/shionui/Card'
import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'
import { AvatarSelector } from './AvatarSelector'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { useShionlibUserStore } from '@/store/userStore'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'

interface AvatarSettingsProps {
  avatar: User['avatar']
  name: User['name']
}

export const AvatarSettings = ({ avatar, name }: AvatarSettingsProps) => {
  const t = useTranslations('Components.User.Settings.Avatar')
  const { updateUser } = useShionlibUserStore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [inputAvatar, setInputAvatar] = useState<string | null>(null)

  const handleUpdate = async () => {
    if (!inputAvatar) return
    try {
      setIsUpdating(true)
      const formData = new FormData()
      const mime = inputAvatar.split(';')[0].split(':')[1]
      const blob = await fetch(inputAvatar).then(res => res.blob())
      const file = new File([blob], 'avatar', { type: mime })
      formData.append('avatar', file)
      const data = await shionlibRequest().fetch<{ key: string }>('/user/info/avatar', {
        method: 'POST',
        data: formData,
      })
      updateUser({ avatar: data.data?.key ?? '' })
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
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
        <CardDescription className="text-card-foreground">{t('help')}</CardDescription>
        <CardAction>
          <AvatarSelector avatar={avatar} name={name} onUpdate={setInputAvatar} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <span className="text-sm text-muted-foreground">{t('tips')}</span>
      </CardContent>
      <CardFooter>
        <Button
          intent="primary"
          onClick={handleUpdate}
          loading={isUpdating}
          disabled={!inputAvatar}
        >
          {t('update')}
        </Button>
      </CardFooter>
    </Card>
  )
}
