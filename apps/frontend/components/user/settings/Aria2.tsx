'use client'

import { initialSettings, useAria2Store } from '@/store/localSettingsStore'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from '@/components/shionui/Card'
import { Input } from '@/components/shionui/Input'
import { Form, FormItem, FormLabel, FormControl } from '@/components/shionui/Form'
import { useForm, Controller } from 'react-hook-form'
import { Zap } from 'lucide-react'
import { InputNumber } from '@/components/shionui/InputNumber'
import { Button } from '@/components/shionui/Button'
import { Alert, AlertDescription, AlertTitle } from '@/components/shionui/Alert'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { sileo } from 'sileo'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'
import { Aria2Settings } from '@/interfaces/aria2/aria2.interface'
import { Aria2Reset } from './aria2/Reset'
import { Aria2Test } from './aria2/Test'

export const Aria2 = () => {
  const t = useTranslations('Components.User.Settings.Aria2')
  const { getSettings, setSettings } = useAria2Store()
  const form = useForm<Aria2Settings>({
    defaultValues: initialSettings,
  })

  useEffect(() => {
    const s = getSettings()
    form.reset({
      protocol: s.protocol,
      host: s.host,
      port: s.port,
      path: s.path,
      auth_secret: s.auth_secret,
      downloadPath: s.downloadPath,
    })
  }, [getSettings, form])

  const onSubmit = (data: Aria2Settings) => {
    setSettings({
      protocol: data.protocol,
      host: data.host,
      port: data.port,
      path: data.path,
      auth_secret: data.auth_secret,
      downloadPath: data.downloadPath,
    })
    sileo.success({ title: t('success') })
  }

  const onSave = () => {
    form.handleSubmit(onSubmit)()
  }

  return (
    <Card data-testid="settings-aria2-card">
      <CardHeader>
        <CardTitle className="text-xl">{t('title')}</CardTitle>
        <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
        <CardAction>
          <Zap className="size-12 text-yellow-500" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormItem>
              <FormLabel>{t('protocol')}</FormLabel>
              <FormControl>
                <Controller
                  name="protocol"
                  control={form.control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className="w-full"
                        data-testid="settings-aria2-protocol-trigger"
                      >
                        <SelectValue placeholder={t('protocolPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="http" data-testid="settings-aria2-protocol-option-http">
                          HTTP
                        </SelectItem>
                        <SelectItem
                          value="https"
                          data-testid="settings-aria2-protocol-option-https"
                        >
                          HTTPS
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>{t('host')}</FormLabel>
              <FormControl>
                <Controller
                  name="host"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      clearable
                      placeholder={t('hostPlaceholder')}
                      data-testid="settings-aria2-host-input"
                    />
                  )}
                />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>{t('port')}</FormLabel>
              <FormControl>
                <Controller
                  name="port"
                  control={form.control}
                  render={({ field }) => (
                    <InputNumber
                      {...field}
                      min={1}
                      max={65535}
                      data-testid="settings-aria2-port-input"
                    />
                  )}
                />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>{t('path')}</FormLabel>
              <FormControl>
                <Controller
                  name="path"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      clearable
                      placeholder={t('pathPlaceholder')}
                      data-testid="settings-aria2-path-input"
                    />
                  )}
                />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>{t('authSecret')}</FormLabel>
              <FormControl>
                <Controller
                  name="auth_secret"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      clearable
                      type="password"
                      data-testid="settings-aria2-auth-secret-input"
                    />
                  )}
                />
              </FormControl>
            </FormItem>
            <FormItem>
              <FormLabel>{t('downloadPath')}</FormLabel>
              <FormControl>
                <Controller
                  name="downloadPath"
                  control={form.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      clearable
                      placeholder={t('downloadPathPlaceholder')}
                      data-testid="settings-aria2-download-path-input"
                    />
                  )}
                />
              </FormControl>
            </FormItem>
          </form>
        </Form>
        <Alert intent="info" appearance="soft" size="sm">
          <AlertTitle className="text-base">{t('tipsTitle')}</AlertTitle>
          <AlertDescription>{t('tipsDescription')}</AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter>
        <div className="flex flex-col gap-3 w-full">
          <div className="flex gap-2 flex-wrap">
            <Button intent="primary" onClick={onSave} data-testid="settings-aria2-save">
              {t('save')}
            </Button>
            <Aria2Reset form={form} />
            <Aria2Test form={form} />
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}
