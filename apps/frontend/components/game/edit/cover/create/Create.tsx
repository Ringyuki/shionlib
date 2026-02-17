import { useRef, useState } from 'react'
import { Edit } from '../Edit'
import type { EditRef } from '../Edit'
import { Button } from '@/components/shionui/Button'
import { PlusIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { z } from 'zod'
import { gameCoverSchemaType } from '../Form'
import { GameCover } from '@/interfaces/game/game.interface'
import { useParams } from 'next/navigation'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'

interface CreateProps {
  onSuccess?: (data: z.infer<typeof gameCoverSchemaType>) => void
}

const defaultCover: GameCover = {
  language: 'jp',
  type: 'dig',
  url: '',
  dims: [],
  sexual: 0,
  violence: 0,
}

export const Create = ({ onSuccess }: CreateProps) => {
  const editRef = useRef<EditRef>(null)
  const [loading, setLoading] = useState(false)
  const t = useTranslations('Components.Game.Edit.Cover.Create')
  const { id: game_id } = useParams()

  const handleSubmit = async (data: z.infer<typeof gameCoverSchemaType>) => {
    const covers = [data]
    try {
      setLoading(true)
      await shionlibRequest().put(`/game/${game_id}/edit/covers`, {
        data: {
          covers,
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
      cover={defaultCover}
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
