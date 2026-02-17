import { GameImage } from '@/interfaces/game/game.interface'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { getAspectRatio } from '../../description/helpers/getPreferredContent'

interface ImageItemProps {
  image: GameImage
  onClick?: () => void
}

export const ImageItem = ({ image, onClick }: ImageItemProps) => {
  const aspect = getAspectRatio(image.dims as [number, number])

  return (
    <div
      className="relative rounded-md overflow-hidden w-full flex flex-col gap-2 cursor-pointer hover:opacity-80 transition-all duration-200"
      style={{ aspectRatio: aspect }}
      onClick={onClick}
    >
      <FadeImage src={image.url} alt="game image" />
    </div>
  )
}
