import { Modal } from '@/components/shionui/Modal'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription, AlertTitle } from '@/components/shionui/Alert'
import { AlertCircle, Info } from 'lucide-react'
import { useState } from 'react'
import { BBCodeContent } from '@/components/common/content/bbcode/BBCode'
import { GameUploadContent } from './GameUploadContent'

interface GameUploadProps {
  game_id: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete: () => void
}

export const GameUpload = ({ game_id, open, onOpenChange, onUploadComplete }: GameUploadProps) => {
  const t = useTranslations('Components.Game.Upload.GameUploadDialog')
  const [closable, setClosable] = useState<boolean>(false)

  return (
    <Modal
      title={t('title')}
      open={open}
      onOpenChange={onOpenChange}
      closable={closable}
      drawerClassName="min-h-[50vh] flex flex-col gap-4"
      dialogClassName="lg:max-w-5xl!"
    >
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
    </Modal>
  )
}
