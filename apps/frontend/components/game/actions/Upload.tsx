import { Button } from '@/components/shionui/Button'
import { Upload as UploadIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { GameUpload } from '../upload/GameUpload'

interface UploadProps {
  game_id: number
}

export const Upload = ({ game_id }: UploadProps) => {
  const [uploadOpen, setUploadOpen] = useState(false)
  const t = useTranslations('Components.Game.Actions')
  return (
    <>
      <Button
        intent="secondary"
        appearance="ghost"
        loginRequired
        onClick={() => setUploadOpen(true)}
        renderIcon={<UploadIcon />}
      >
        {t('upload')}
      </Button>
      <GameUpload
        game_id={game_id}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploadComplete={() => setUploadOpen(false)}
      />
    </>
  )
}
