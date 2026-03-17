'use client'

import { GameLink } from '@/interfaces/game/game.interface'
import { useState, useEffect } from 'react'
import { Modal } from '@/components/shionui/Modal'
import { LinkItem } from './Item'
import { LinkFormValues } from './Form'
import { shionlibRequest } from '@/utils/request'
import { sileo } from 'sileo'
import { useTranslations } from 'next-intl'
import { EditContent } from './EditContent'

interface EditProps {
  link: GameLink
  game_id: number
  onSuccess?: (link: GameLink) => void
  onDelete?: (id: number) => void
}

export const Edit = ({ link, game_id, onSuccess, onDelete }: EditProps) => {
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentLink, setCurrentLink] = useState(link)
  const t = useTranslations('Components.Game.Edit.Link')

  useEffect(() => {
    setCurrentLink(link)
  }, [link])

  const handleSubmit = async (data: LinkFormValues) => {
    try {
      setIsSubmitting(true)
      await shionlibRequest().patch(`/game/${game_id}/edit/links`, {
        data: {
          links: [{ id: currentLink.id, ...data }],
        },
      })
      sileo.success({ title: t('updated') })
      const updated: GameLink = { ...currentLink, ...data }
      setCurrentLink(updated)
      onSuccess?.(updated)
      setOpen(false)
    } catch {
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    setOpen(false)
    await new Promise(resolve => setTimeout(resolve, 300))
    onDelete?.(id)
  }

  return (
    <>
      <LinkItem link={currentLink} onClick={() => setOpen(true)} />
      <Modal title={t('Edit.title')} open={open} onOpenChange={setOpen}>
        <EditContent
          link={currentLink}
          game_id={game_id}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onDelete={handleDelete}
        />
      </Modal>
    </>
  )
}
