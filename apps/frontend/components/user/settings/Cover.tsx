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
import { CoverSelector } from './CoverSelector'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { useShionlibUserStore } from '@/store/userStore'
import { sileo } from 'sileo'

interface CoverSettingsProps {
  cover: User['cover']
}

export const CoverSettings = ({ cover }: CoverSettingsProps) => {
  const t = useTranslations('Components.User.Settings.Cover')
  const { updateUser } = useShionlibUserStore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [inputCover, setInputCover] = useState<string | null>(null)

  const handleUpdate = async () => {
    if (!inputCover) return
    try {
      setIsUpdating(true)
      const formData = new FormData()
      const mime = inputCover.split(';')[0].split(':')[1]
      const blob = await fetch(inputCover).then(res => res.blob())
      const file = new File([blob], 'cover', { type: mime })
      formData.append('cover', file)
      const data = await shionlibRequest().fetch<{ key: string }>('/user/info/cover', {
        method: 'POST',
        data: formData,
      })
      updateUser({ cover: data.data?.key ?? '' })
      sileo.success({ title: t('success') })
      setInputCover(null)
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
          <CoverSelector cover={cover} onUpdate={setInputCover} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <span className="text-sm text-muted-foreground">{t('tips')}</span>
      </CardContent>
      <CardFooter>
        <Button intent="primary" onClick={handleUpdate} loading={isUpdating} disabled={!inputCover}>
          {t('update')}
        </Button>
      </CardFooter>
    </Card>
  )
}
