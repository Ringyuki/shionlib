import { Aria2 } from '@/components/user/settings/Aria2'

interface DownloadSettingsProps {}

export const DownloadSettings = () => {
  return (
    <div className="w-full flex flex-col gap-4">
      <Aria2 />
    </div>
  )
}
