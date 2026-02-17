'use client'

import { DeveloperRelation } from '@/interfaces/game/game.interface'
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useMedia } from 'react-use'
import { EditDialog } from './EditDialog'
import { EditDrawer } from './EditDrawer'
import { DeveloperRelationItem } from './Item'
import { z } from 'zod'
import { developerRelationSchemaType } from './Form'
import { shionlibRequest } from '@/utils/request'
// import toast from 'react-hot-toast'
import { sileo } from 'sileo'
import { useTranslations } from 'next-intl'

export interface EditRef {
  open: () => void
  close: () => void
}

interface EditProps {
  relation: DeveloperRelation
  game_id: number
  onSuccess?: (
    data: z.infer<typeof developerRelationSchemaType>,
    relation: DeveloperRelation,
  ) => void
  onDelete?: (id: number) => void
}

export const Edit = forwardRef<EditRef, EditProps>(
  ({ relation, game_id, onSuccess, onDelete }, ref) => {
    const isMobile = useMedia('(max-width: 1024px)', false)
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [currentRelation, setCurrentRelation] = useState(relation)
    const t = useTranslations('Components.Game.Edit.Developer')

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

    const handleSubmit = async (data: z.infer<typeof developerRelationSchemaType>) => {
      try {
        setIsSubmitting(true)
        await shionlibRequest().patch(`/game/${game_id}/edit/developers`, {
          data: {
            developers: [
              {
                id: currentRelation.id,
                developer_id: currentRelation.developer_id,
                role: data.role,
              },
            ],
          },
        })
        // toast.success(t('updated'))
        sileo.success({ title: t('updated') })
        const updatedRelation: DeveloperRelation = {
          ...currentRelation,
          role: data.role ?? null,
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

    const EditComponent = isMobile ? EditDrawer : EditDialog

    return (
      <>
        <DeveloperRelationItem relation={currentRelation} onClick={() => setOpen(true)} />
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
Edit.displayName = 'DeveloperRelationEdit'
