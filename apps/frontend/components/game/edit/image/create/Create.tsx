import { useRef, useState } from 'react'
import { Edit } from '../Edit'
import type { EditRef } from '../Edit'
import { Button } from '@/components/shionui/Button'
import { PlusIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { gameImageSchemaType } from '../Form'
import { GameImage } from '@/interfaces/game/game.interface'
import { useParams } from 'next/navigation'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'

interface CreateProps {
  onSuccess?: (data: z.infer<typeof gameImageSchemaType>) => void
}

const defaultImage: GameImage = {
  url: '',
  dims: [],
  sexual: 0,
  violence: 0,
}

export const Create = ({ onSuccess }: CreateProps) => {
  const editRef = useRef<EditRef>(null)
  const [loading, setLoading] = useState(false)
  const t = useTranslations('Components.Game.Edit.Image.Create')
  const { id: game_id } = useParams()

  const handleSubmit = async (data: z.infer<typeof gameImageSchemaType>) => {
    const images = [data]
    try {
      setLoading(true)
      await shionlibRequest().put(`/game/${game_id}/edit/images`, {
        data: {
          images,
        },
      })
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
      onSuccess?.(data)
      editRef.current?.close()
    } catch {
    } finally {
      setLoading(false)
    }
  }
  return (
    <Edit
      ref={editRef}
      image={defaultImage}
      onSubmit={handleSubmit}
      loading={loading}
      trigger={
        <Button
          onClick={() => editRef.current?.open()}
          renderIcon={<PlusIcon className="w-4 h-4" />}
          className="w-full"
        >
          {t('create')}
        </Button>
      }
    />
  )
}
