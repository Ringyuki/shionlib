import { Aria2 } from '@/components/user/settings/Aria2'
import { LunaBoxSettings } from '@/components/user/settings/LunaBox'

export const DownloadSettings = () => {
  return (
    <div className="w-full flex flex-col gap-4">
      <Aria2 />
      <LunaBoxSettings />
    </div>
  )
}
