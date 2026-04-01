import { KunPatchResourceResponse } from '@/interfaces/patch/patch.interface'
import { PatchItem } from './PatchItem'
import { cn } from '@/utils/cn'
import { Moyu } from './about/Moyu'
import { AdSlotClient } from '@/components/common/site/Ad'
import { AD_PLACEMENTS } from '@/constants/ad-placements'

interface PatchContentProps {
  patches: KunPatchResourceResponse[]
  className?: string
}

export const PatchContent = ({ patches, className }: PatchContentProps) => {
  return (
    <div className="overflow-y-auto w-full md:max-w-[-webkit-fill-available] md:w-184 mx-auto">
      <div className={cn('flex flex-col gap-4 w-full', className)}>
        {patches
          .filter(patch => patch.type.includes('manual'))
          .sort((a, b) => b.download - a.download)
          .map(patch => (
            <PatchItem key={patch.id} patch={patch} />
          ))}
        {patches
          .filter(patch => !patch.type.includes('manual'))
          .sort((a, b) => b.download - a.download)
          .map(patch => (
            <PatchItem key={patch.id} patch={patch} />
          ))}
        <AdSlotClient placement={AD_PLACEMENTS.GAME_PATCH_BOTTOM_1} />
        <AdSlotClient placement={AD_PLACEMENTS.GAME_PATCH_BOTTOM_2} />
      </div>
      <Moyu />
    </div>
  )
}
