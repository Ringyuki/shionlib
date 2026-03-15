'use client'

import { GameCharacterRelation } from '@/interfaces/game/game.interface'
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Modal } from '@/components/shionui/Modal'
import { CharacterRelationItem } from './Item'
import { z } from 'zod'
import { characterRelationSchemaType } from './Form'
import { shionlibRequest } from '@/utils/request'
import { sileo } from 'sileo'
import { useTranslations } from 'next-intl'
import { EditContent } from './EditContent'

export interface EditRef {
  open: () => void
  close: () => void
}

interface EditProps {
  relation: GameCharacterRelation
  game_id: number
  onSuccess?: (
    data: z.infer<typeof characterRelationSchemaType>,
    relation: GameCharacterRelation,
  ) => void
  onDelete?: (id: number) => void
  onImageUpdate?: (id: number, imageKey: string) => void
}

export const Edit = forwardRef<EditRef, EditProps>(
  ({ relation, game_id, onSuccess, onDelete, onImageUpdate }, ref) => {
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [currentRelation, setCurrentRelation] = useState(relation)
    const t = useTranslations('Components.Game.Edit.Character')

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

    const handleSubmit = async (data: z.infer<typeof characterRelationSchemaType>) => {
      try {
        setIsSubmitting(true)
        await shionlibRequest().patch(`/game/${game_id}/edit/characters`, {
          data: {
            characters: [
              {
                id: currentRelation.id,
                character_id: currentRelation.character_id,
                role: data.role,
                actor: data.actor,
                image: data.image,
              },
            ],
          },
        })
        sileo.success({ title: t('updated') })
        const updatedRelation: GameCharacterRelation = {
          ...currentRelation,
          role: data.role ?? undefined,
          actor: data.actor ?? undefined,
          image: data.image ?? undefined,
        }
        setCurrentRelation(updatedRelation)
        onSuccess?.(data, updatedRelation)
        if (data.image && data.image !== relation.image) {
          onImageUpdate?.(currentRelation.id, data.image)
        }
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
        <CharacterRelationItem relation={currentRelation} onClick={() => setOpen(true)} />
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
Edit.displayName = 'CharacterRelationEdit'
