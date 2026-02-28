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
import { Textarea } from '@/components/shionui/Textarea'
import { FileText } from 'lucide-react'

interface BioSettingsProps {
  bio: User['bio']
}

export const BioSettings = ({ bio }: BioSettingsProps) => {
  const t = useTranslations('Components.User.Settings.Bio')
  const { updateUser } = useShionlibUserStore()
  const [isUpdating, setIsUpdating] = useState(false)
  const [inputBio, setInputBio] = useState<string>(bio ?? '')
  const initialBio = bio ?? ''

  const handleUpdate = async () => {
    try {
      setIsUpdating(true)
      const data = await shionlibRequest().post<{ bio: string }>('/user/info/bio', {
        data: { bio: inputBio },
      })
      updateUser({ bio: data.data?.bio ?? inputBio })
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
        <CardAction>
          <FileText className="size-12 text-primary" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Textarea
          value={inputBio}
          onChange={e => setInputBio(e.target.value)}
          maxLength={500}
          rows={4}
          clearable
        />
      </CardContent>
      <CardFooter>
        <Button
          loginRequired
          intent="primary"
          onClick={handleUpdate}
          loading={isUpdating}
          disabled={initialBio === inputBio}
        >
          {t('update')}
        </Button>
      </CardFooter>
    </Card>
  )
}
