import { GameCover } from '@/interfaces/game/game.interface'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { getAspectRatio } from '../../description/helpers/getPreferredContent'

interface CoverItemProps {
  cover: GameCover
  onClick?: () => void
}

export const CoverItem = ({ cover, onClick }: CoverItemProps) => {
  const aspect = getAspectRatio(cover.dims as [number, number])

  return (
    <div
      className="relative rounded-md overflow-hidden w-full flex flex-col gap-2 cursor-pointer hover:opacity-80 transition-all duration-200"
      style={{ aspectRatio: aspect }}
      onClick={onClick}
    >
      <FadeImage src={cover.url} alt={cover.language} />
    </div>
  )
}
