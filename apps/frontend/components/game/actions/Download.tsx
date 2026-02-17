import { Button } from '@/components/shionui/Button'
import { Download as DownloadIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { GameDownload } from '../download/GameDownload'

interface DownloadProps {
  game_id: number
}

export const Download = ({ game_id }: DownloadProps) => {
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloadBtnLoading, setDownloadBtnLoading] = useState(false)
  const t = useTranslations('Components.Game.Actions')
  return (
    <>
      <Button
        intent="primary"
        onClick={() => setDownloadOpen(true)}
        loading={downloadBtnLoading}
        renderIcon={<DownloadIcon />}
      >
        {t('download')}
      </Button>
      <GameDownload
        game_id={game_id}
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        onLoadingChange={setDownloadBtnLoading}
      />
    </>
  )
}
