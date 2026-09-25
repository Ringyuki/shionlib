'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
import { shionlibRequest } from '@/utils/request'
import { sileo } from 'sileo'
import { Download } from 'lucide-react'

interface GameListSettingsProps {
  initialOnlyGamesWithResources: boolean
}

export const GameListSettings = ({ initialOnlyGamesWithResources }: GameListSettingsProps) => {
  const t = useTranslations('Components.User.Settings.GameList')
  const [onlyGamesWithResources, setOnlyGamesWithResources] = useState(
    initialOnlyGamesWithResources,
  )
  const [isUpdating, setIsUpdating] = useState(false)

  const handleChange = async (checked: boolean) => {
    const previous = onlyGamesWithResources
    setOnlyGamesWithResources(checked)
    try {
      setIsUpdating(true)
      await shionlibRequest().post('/user/info/only-games-with-resources', {
        data: { only_games_with_resources: checked },
      })
      sileo.success({ title: t('success') })
    } catch {
      setOnlyGamesWithResources(previous)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card data-testid="settings-game-list-card">
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
        <CardAction>
          <Download className="size-12 text-sky-600" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Switch
            id="only-games-with-resources"
            data-testid="settings-only-games-with-resources-switch"
            checked={onlyGamesWithResources}
            disabled={isUpdating}
            onCheckedChange={checked => handleChange(!!checked)}
          />
          <Label htmlFor="only-games-with-resources">{t('onlyGamesWithResources')}</Label>
        </div>
      </CardContent>
    </Card>
  )
}
