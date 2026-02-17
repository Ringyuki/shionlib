import { Image as GameImageEditComponent } from '@/components/game/edit/Image'
import { shionlibRequest } from '@/utils/request'
import { GameImage } from '@/interfaces/game/game.interface'

interface ImagePageProps {
  params: Promise<{ id: string }>
}

export default async function ImagePage({ params }: ImagePageProps) {
  const { id } = await params
  const data = await shionlibRequest().get<GameImage[]>(`/edit/game/${id}/image`)

  return <GameImageEditComponent images={data?.data ?? []} />
}
