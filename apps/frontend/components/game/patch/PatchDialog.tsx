import { Dialog, DialogTitle, DialogContent, DialogHeader } from '@/components/shionui/Dialog'
import { KunPatchResourceResponse } from '@/interfaces/patch/patch.interface'
import { PatchContent } from './PatchContent'
import { useTranslations } from 'next-intl'

interface PatchDialogProps {
  patches: KunPatchResourceResponse[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const PatchDialog = ({ patches, open, onOpenChange }: PatchDialogProps) => {
  const t = useTranslations('Components.Game.Patch.PatchDialog')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} fitContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <PatchContent className="px-0 pb-4" patches={patches} />
      </DialogContent>
    </Dialog>
  )
}
