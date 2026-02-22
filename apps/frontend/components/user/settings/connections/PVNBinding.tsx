'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMedia } from 'react-use'
import { sileo } from 'sileo'
import { Unlink } from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
} from '@/components/shionui/Card'
import { Button } from '@/components/shionui/Button'
import { Badge } from '@/components/shionui/Badge'
import { shionlibRequest } from '@/utils/request'
import { BindDialog } from './pvn/BindDialog'
import { BindDrawer } from './pvn/BindDrawer'
import { type BindFormValues } from './pvn/BindForm'
import { UnbindConfirm } from './pvn/UnbindConfirm'
import { Status } from './pvn/Status'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { PVNBindingInfo } from '@/interfaces/potatovn/potatovn-binding.interface'

interface PVNBindingProps {
  initialBinding: PVNBindingInfo | null
}

export const PVNBinding = ({ initialBinding }: PVNBindingProps) => {
  const t = useTranslations('Components.User.Settings.Connections.PotatoVN')
  const isMobile = useMedia('(max-width: 1024px)', false)

  const [binding, setBinding] = useState<PVNBindingInfo | null>(initialBinding)
  const [bindOpen, setBindOpen] = useState(false)
  const [unbindOpen, setUnbindOpen] = useState(false)
  const [isBinding, setIsBinding] = useState(false)
  const [isUnbinding, setIsUnbinding] = useState(false)

  const isConnected = !!binding

  const handleBind = async (data: BindFormValues) => {
    setIsBinding(true)
    try {
      const res = await shionlibRequest().post<PVNBindingInfo>('/potatovn/binding', { data })
      setBinding(res.data!)
      setBindOpen(false)
      sileo.success({ title: t('connectSuccess') })
    } catch {
    } finally {
      setIsBinding(false)
    }
  }

  const handleUnbind = async () => {
    setIsUnbinding(true)
    try {
      await shionlibRequest().delete('/potatovn/binding')
      setBinding(null)
      setUnbindOpen(false)
      sileo.success({ title: t('disconnectSuccess') })
    } catch {
    } finally {
      setIsUnbinding(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <FadeImage
              src="/assets/images/pvn/pvn-logo.png"
              alt="PotatoVN"
              className="size-6 rounded-sm object-contain"
            />
            {t('title')}
          </CardTitle>
          <CardDescription className="text-card-foreground">{t('description')}</CardDescription>
          <CardAction>
            <Badge
              intent={isConnected ? 'success' : 'neutral'}
              appearance={isConnected ? 'solid' : 'outline'}
            >
              {isConnected ? t('connected') : t('notConnected')}
            </Badge>
          </CardAction>
        </CardHeader>

        {binding && <Status isConnected={isConnected} binding={binding} />}

        <CardFooter>
          {isConnected ? (
            <Button
              intent="destructive"
              onClick={() => setUnbindOpen(true)}
              renderIcon={<Unlink />}
            >
              {t('disconnect')}
            </Button>
          ) : (
            <Button intent="primary" onClick={() => setBindOpen(true)}>
              {t('connect')}
            </Button>
          )}
        </CardFooter>
      </Card>

      {isMobile ? (
        <BindDrawer
          open={bindOpen}
          onOpenChange={setBindOpen}
          onSubmit={handleBind}
          isSubmitting={isBinding}
        />
      ) : (
        <BindDialog
          open={bindOpen}
          onOpenChange={setBindOpen}
          onSubmit={handleBind}
          isSubmitting={isBinding}
        />
      )}

      <UnbindConfirm
        open={unbindOpen}
        onOpenChange={setUnbindOpen}
        onConfirm={handleUnbind}
        isLoading={isUnbinding}
      />
    </>
  )
}
