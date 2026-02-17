import { GameImage } from '@/interfaces/game/game.interface'
import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useMedia } from 'react-use'
import { EditDialog } from './EditDialog'
import { EditDrawer } from './EditDrawer'
import { ImageItem } from './Item'
import { z } from 'zod'
import { gameImageSchemaType } from './Form'
import { shionlibRequest } from '@/utils/request'
// import toast from 'react-hot-toast'
import { sileo } from 'sileo'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'

export interface EditRef {
  open: () => void
  close: () => void
}

interface EditProps {
  image: GameImage
  onSuccess?: (data: z.infer<typeof gameImageSchemaType>, id: number) => void
  trigger?: React.ReactNode
  onOpenChange?: (open: boolean) => void
  onSubmit?: (data: z.infer<typeof gameImageSchemaType>) => void
  loading?: boolean
  onDelete?: (id: number) => void
}

export const Edit = forwardRef<EditRef, EditProps>(
  (
    { image, onSuccess, trigger, onOpenChange, onSubmit, loading = false, onDelete }: EditProps,
    ref,
  ) => {
    const isMobile = useMedia('(max-width: 1024px)', false)
    const [open, setOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const t = useTranslations('Components.Game.Edit.Image')
    const { id: game_id } = useParams()

    useEffect(() => {
      onOpenChange?.(open)
    }, [open, onOpenChange])

    useImperativeHandle(
      ref,
      () => ({
        open: () => setOpen(true),
        close: () => setOpen(false),
      }),
      [],
    )

    const handleSubmit = async (data: z.infer<typeof gameImageSchemaType>) => {
      if (onSubmit) {
        onSubmit(data)
        return
      }
      try {
        setIsSubmitting(true)
        await shionlibRequest().patch(`/game/${game_id}/edit/image`, {
          data: {
            id: image.id,
            ...data,
          },
        })
        // toast.success(t('success'))
        sileo.success({ title: t('success') })
        onSuccess?.(data, image.id!)
        setOpen(false)
        onOpenChange?.(false)
      } catch {
      } finally {
        setIsSubmitting(false)
      }
    }

    const handleDelete = async (id: number) => {
      setOpen(false)
      onOpenChange?.(false)
      await new Promise(resolve => setTimeout(resolve, 500))
      onDelete?.(id)
    }
    return (
      <>
        {trigger ? trigger : <ImageItem image={image} onClick={() => setOpen(true)} />}
        {isMobile ? (
          <EditDrawer
            image={image}
            open={open}
            onOpenChange={setOpen}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting || loading}
            onDelete={handleDelete}
          />
        ) : (
          <EditDialog
            image={image}
            open={open}
            onOpenChange={setOpen}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting || loading}
            onDelete={handleDelete}
          />
        )}
      </>
    )
  },
)
Edit.displayName = 'Edit'
