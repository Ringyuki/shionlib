'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/shionui/Card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'
import { Button } from '@/components/shionui/Button'
import { Alert, AlertDescription, AlertTitle } from '@/components/shionui/Alert'
import { BellRing } from 'lucide-react'
import {
  useDefaultToastPosition,
  toastPositions,
  ToastPosition,
  useToastPreferenceStore,
} from '@/store/localSettingsStore'
import { sileo } from 'sileo'

export const ToastPositionSettings = () => {
  const t = useTranslations('Components.User.Settings.ToastPosition')
  const savedPosition = useToastPreferenceStore(state => state.position)
  const setSavedPosition = useToastPreferenceStore(state => state.setPosition)
  const defaultPosition = useDefaultToastPosition()
  const [position, setPosition] = useState<ToastPosition>(savedPosition ?? defaultPosition)

  useEffect(() => {
    setPosition(savedPosition ?? defaultPosition)
  }, [savedPosition, defaultPosition])

  const canUpdate = useMemo(() => position !== savedPosition, [position, savedPosition])

  const handleUpdate = () => {
    setSavedPosition(position)
    sileo.success({ title: t('success'), position })
  }

  const defaultToastPosition = useDefaultToastPosition()
  const handleReset = () => {
    setPosition(defaultToastPosition)
    setSavedPosition(defaultToastPosition)
    sileo.success({ title: t('resetSuccess'), position: defaultToastPosition })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
        <CardAction>
          <BellRing className="size-12 text-primary" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Select value={position} onValueChange={value => setPosition(value as ToastPosition)}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectPosition')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t('choosePosition')}</SelectLabel>
              {toastPositions.map(item => (
                <SelectItem key={item} value={item}>
                  {t(item)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Alert intent="info" appearance="soft" size="sm">
          <AlertTitle className="text-base">{t('tipsTitle')}</AlertTitle>
          <AlertDescription>{t('tipsDescription')}</AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter className="gap-2">
        <Button intent="primary" onClick={handleUpdate} disabled={!canUpdate}>
          {t('update')}
        </Button>
        <Button intent="secondary" appearance="outline" onClick={handleReset}>
          {t('reset')}
        </Button>
      </CardFooter>
    </Card>
  )
}
