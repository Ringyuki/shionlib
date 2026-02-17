'use client'

import { Header } from './Header'
import { CreateGameForm } from './Form'
import { z } from 'zod'
import { createGameFormSchema } from './Form'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { CreateAlert } from './Alert'
import { useLocale } from 'next-intl'

export const CreateGame = () => {
  const t = useTranslations('Components.Create.Create')
  const [loading, setLoading] = useState(false)
  const locale = useLocale()
  const handleSubmit = async (data: z.infer<typeof createGameFormSchema>) => {
    try {
      setLoading(true)
      const v_id = parseInt(data.vndbId.replace('v', ''))
      const b_id = parseInt(data.bangumiId)
      if (isNaN(v_id) || isNaN(b_id)) {
        // toast.error(t('invalidId'))
        sileo.error({ title: t('invalidId') })
        return
      }
      const res = await shionlibRequest().post<number>('/game/create/frombv', {
        data: {
          v_id,
          b_id,
          skip_consistency_check: data.skipConsistencyCheck,
        },
      })
      // toast.success(t('success', { id: res.data! }), { duration: 10000 })
      sileo.success({
        title: t('success', { id: res.data! }),
        duration: 10000,
        description: t('successDescription'),
        styles: {
          description: 'dark:text-background',
        },
        button: {
          title: t('view'),
          onClick: () => window.open(`/${locale}/game/${res.data!}`, '_blank'),
        },
        autopilot: {
          collapse: 10000,
        },
      })
    } catch {
    } finally {
      setLoading(false)
    }
  }
  return (
    <>
      <Header />
      <CreateGameForm onSubmit={handleSubmit} loading={loading} />
      <CreateAlert />
    </>
  )
}
