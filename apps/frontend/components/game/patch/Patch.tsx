import { useMedia } from 'react-use'
import { PatchDialog } from './PatchDialog'
import { PatchDrawer } from './PatchDrawer'
import { KunPatchResourceResponse } from '@/interfaces/patch/patch.interface'

interface PatchProps {
  patches: KunPatchResourceResponse[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const Patch = ({ patches, open, onOpenChange }: PatchProps) => {
  const isMobile = useMedia('(max-width: 1024px)', false)
  return (
    <>
      {isMobile ? (
        <PatchDrawer patches={patches} open={open} onOpenChange={onOpenChange} />
      ) : (
        <PatchDialog patches={patches} open={open} onOpenChange={onOpenChange} />
      )}
    </>
  )
}
