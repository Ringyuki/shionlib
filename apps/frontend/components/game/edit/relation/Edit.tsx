'use client'

import { GameRelation, GameRelationType } from '@/interfaces/game/game.interface'
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Modal } from '@/components/shionui/Modal'
import { RelationItem } from './Item'
import { z } from 'zod'
import { relationSchemaType } from './Form'
import { shionlibRequest } from '@/utils/request'
import { sileo } from 'sileo'
import { useTranslations } from 'next-intl'
import { EditContent } from './EditContent'

export interface EditRef {
  open: () => void
  close: () => void
}

interface EditProps {
  relation: GameRelation
  game_id: number
  onSuccess?: (data: z.infer<typeof relationSchemaType>, relation: GameRelation) => void
  onDelete?: (id: number) => void
}

export const Edit = forwardRef<EditRef, EditProps>(
  ({ relation, game_id, onSuccess, onDelete }, ref) => {
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [currentRelation, setCurrentRelation] = useState(relation)
    const t = useTranslations('Components.Game.Edit.Relation')

    useEffect(() => {
      setCurrentRelation(relation)
    }, [relation])

    useImperativeHandle(
      ref,
      () => ({
        open: () => setOpen(true),
        close: () => setOpen(false),
      }),
      [],
    )

    const handleSubmit = async (data: z.infer<typeof relationSchemaType>) => {
      try {
        setIsSubmitting(true)
        await shionlibRequest().patch(`/game/${game_id}/edit/relations`, {
          data: {
            relations: [{ id: currentRelation.id, relation: data.relation }],
          },
        })
        sileo.success({ title: t('updated') })
        const updatedRelation: GameRelation = {
          ...currentRelation,
          relation: data.relation as GameRelationType,
        }
        setCurrentRelation(updatedRelation)
        onSuccess?.(data, updatedRelation)
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
        <RelationItem relation={currentRelation} onClick={() => setOpen(true)} />
        <Modal title={t('Edit.title')} open={open} onOpenChange={setOpen}>
          <EditContent
            relation={currentRelation}
            game_id={game_id}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            onDelete={handleDelete}
          />
        </Modal>
      </>
    )
  },
)
Edit.displayName = 'RelationEdit'
