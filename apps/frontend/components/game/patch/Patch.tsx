import { Modal } from '@/components/shionui/Modal'
import { useTranslations } from 'next-intl'
import { MoyuPatchResource } from '@/interfaces/patch/patch.interface'
import { PatchContent } from './PatchContent'

interface PatchProps {
  patches: MoyuPatchResource[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const Patch = ({ patches, open, onOpenChange }: PatchProps) => {
  const t = useTranslations('Components.Game.Patch')
  return (
    <Modal
      title={t('title')}
      open={open}
      onOpenChange={onOpenChange}
      fitContent
      drawerClassName="min-h-[50vh]"
    >
      <PatchContent className="px-0 pb-4" patches={patches} />
    </Modal>
  )
}
