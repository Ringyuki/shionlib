import { Aria2 } from '@/components/user/settings/Aria2'
import { LunaBoxSettings } from '@/components/user/settings/LunaBox'
import { ReinaSettings } from '@/components/user/settings/Reina'
import { PotatoVNSettings } from '@/components/user/settings/PotatoVN'

export const DownloadSettings = () => {
  return (
    <div className="w-full flex flex-col gap-4">
      <Aria2 />
      <LunaBoxSettings />
      <ReinaSettings />
      <PotatoVNSettings />
    </div>
  )
}
