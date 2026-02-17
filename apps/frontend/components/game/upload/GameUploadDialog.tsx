import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/shionui/Dialog'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription, AlertTitle } from '@/components/shionui/Alert'
import { AlertCircle, Info } from 'lucide-react'
import { useState } from 'react'
import { BBCodeContent } from '@/components/common/content/BBCode'
import { GameUploadContent } from './GameUploadContent'

interface GameUploadDialogProps {
  game_id: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete: () => void
}

export const GameUploadDialog = ({
  game_id,
  open,
  onOpenChange,
  onUploadComplete,
}: GameUploadDialogProps) => {
  const t = useTranslations('Components.Game.Upload.GameUploadDialog')
  const [closable, setClosable] = useState<boolean>(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange} maskClosable={closable}>
      <DialogContent className="lg:max-w-5xl!" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <Alert intent="info" appearance="solid">
          <Info />
          <AlertTitle>{t('alert1Title')}</AlertTitle>
          <AlertDescription>
            <BBCodeContent content={t('alert1Description')} />
          </AlertDescription>
        </Alert>
        <Alert intent="warning" appearance="solid">
          <AlertCircle />
          <AlertTitle>{t('alert2Title')}</AlertTitle>
          <AlertDescription>
            <BBCodeContent content={t('alert2Description')} />
          </AlertDescription>
        </Alert>
        <GameUploadContent
          game_id={game_id}
          onClosableChange={setClosable}
          onUploadComplete={onUploadComplete}
        />
      </DialogContent>
    </Dialog>
  )
}
