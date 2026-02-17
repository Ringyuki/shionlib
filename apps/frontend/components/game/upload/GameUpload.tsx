import { GameUploadDialog } from './GameUploadDialog'
import { GameUploadDrawer } from './GameUploadDrawer'
import { useMedia } from 'react-use'

interface GameUploadProps {
  game_id: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete: () => void
}

export const GameUpload = ({ game_id, open, onOpenChange, onUploadComplete }: GameUploadProps) => {
  const isMobile = useMedia('(max-width: 1024px)', false)
  return (
    <div className="hidden">
      {isMobile ? (
        <GameUploadDrawer
          game_id={game_id}
          open={open}
          onOpenChange={onOpenChange}
          onUploadComplete={onUploadComplete}
        />
      ) : (
        <GameUploadDialog
          game_id={game_id}
          open={open}
          onOpenChange={onOpenChange}
          onUploadComplete={onUploadComplete}
        />
      )}
    </div>
  )
}
