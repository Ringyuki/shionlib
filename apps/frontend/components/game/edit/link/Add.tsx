'use client'

import { useState } from 'react'
import { shionlibRequest } from '@/utils/request'
import { sileo } from 'sileo'
import { useTranslations } from 'next-intl'
import { GameLink } from '@/interfaces/game/game.interface'
import { LinkFormValues, LinkForm } from './Form'

interface AddProps {
  game_id: number
  onAdd: (link: GameLink) => void
}

export const Add = ({ game_id, onAdd }: AddProps) => {
  const t = useTranslations('Components.Game.Edit.Link.Add')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (data: LinkFormValues) => {
    try {
      setLoading(true)
      await shionlibRequest().put(`/game/${game_id}/edit/links`, {
        data: { links: [data] },
      })
      sileo.success({ title: t('success') })
      onAdd({ id: Date.now(), ...data })
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{t('title')}</h3>
      <LinkForm onSubmit={handleSubmit} loading={loading} submitLabel={t('submit')} />
    </div>
  )
}
