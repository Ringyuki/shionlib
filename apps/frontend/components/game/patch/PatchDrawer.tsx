import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/shionui/Drawer'
import { KunPatchResourceResponse } from '@/interfaces/patch/patch.interface'
import { PatchContent } from './PatchContent'
import { useTranslations } from 'next-intl'

interface PatchDrawerProps {
  patches: KunPatchResourceResponse[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const PatchDrawer = ({ patches, open, onOpenChange }: PatchDrawerProps) => {
  const t = useTranslations('Components.Game.Patch.PatchDrawer')
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="min-h-[50vh]">
        <DrawerHeader>
          <DrawerTitle>{t('title')}</DrawerTitle>
        </DrawerHeader>
        <PatchContent patches={patches} className="pb-4" />
      </DrawerContent>
    </Drawer>
  )
}
