'use client'

import { GameCharacterRelation } from '@/interfaces/game/game.interface'
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useMedia } from 'react-use'
import { EditDialog } from './EditDialog'
import { EditDrawer } from './EditDrawer'
import { CharacterRelationItem } from './Item'
import { z } from 'zod'
import { characterRelationSchemaType } from './Form'
import { shionlibRequest } from '@/utils/request'
// import toast from 'react-hot-toast'
import { sileo } from 'sileo'
import { useTranslations } from 'next-intl'

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
    const isMobile = useMedia('(max-width: 1024px)', false)
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
        // toast.success(t('updated'))
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

    const EditComponent = isMobile ? EditDrawer : EditDialog

    return (
      <>
        <CharacterRelationItem relation={currentRelation} onClick={() => setOpen(true)} />
        <EditComponent
          relation={currentRelation}
          game_id={game_id}
          open={open}
          onOpenChange={setOpen}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          onDelete={handleDelete}
        />
      </>
    )
  },
)
Edit.displayName = 'CharacterRelationEdit'
