import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription, AlertTitle } from '@/components/shionui/Alert'
import { AlertCircle, Info } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/utils/cn'
import { BBCodeContent } from '@/components/common/content/BBCode'
import { GameUploadContent } from './GameUploadContent'

interface GameUploadDrawerProps {
  className?: string
  game_id: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete: () => void
}

export const GameUploadDrawer = ({
  className,
  game_id,
  open,
  onOpenChange,
  onUploadComplete,
}: GameUploadDrawerProps) => {
  const t = useTranslations('Components.Game.Upload.GameUploadDialog')
  const [closable, setClosable] = useState<boolean>(false)

  return (
    <Drawer open={open} onOpenChange={onOpenChange} dismissible={closable}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <div
          className={cn(className, 'flex flex-col gap-4 max-w-7xl px-3 mx-auto overflow-y-auto')}
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
            className="mb-4 w-full"
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
