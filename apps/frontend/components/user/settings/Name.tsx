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
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { useShionlibUserStore } from '@/store/userStore'
import { sileo } from 'sileo'
import { Input } from '@/components/shionui/Input'
import { TextCursorInput } from 'lucide-react'

interface NameSettingsProps {
  name: User['name']
}

export const NameSettings = ({ name }: NameSettingsProps) => {
  const t = useTranslations('Components.User.Settings.Name')
  const { updateUser } = useShionlibUserStore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [inputName, setInputName] = useState<string | null>(name)
  const initialName = name

  const handleUpdate = async () => {
    if (!inputName) return
    try {
      setIsUpdating(true)
      const data = await shionlibRequest().post<{ name: string }>('/user/info/name', {
        data: { name: inputName.trim() },
      })
      updateUser({ name: data.data?.name ?? '' })
      sileo.success({ title: t('success') })
    } catch {
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card data-testid="settings-name-card">
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
        <CardAction>
          <TextCursorInput className="size-12 text-primary" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Input
          data-testid="settings-name-input"
          value={inputName ?? ''}
          onChange={e => setInputName(e.target.value.trim())}
          maxLength={20}
          clearable
        />
      </CardContent>
      <CardFooter>
        <Button
          data-testid="settings-name-update"
          loginRequired
          intent="primary"
          onClick={handleUpdate}
          loading={isUpdating}
          disabled={!inputName || initialName === inputName}
        >
          {t('update')}
        </Button>
      </CardFooter>
    </Card>
  )
}
