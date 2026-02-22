import { PVNBinding } from '@/components/user/settings/connections/PVNBinding'
import { PVNBindingInfo } from '@/interfaces/potatovn/potatovn-binding.interface'

interface ConnectionsSettingsProps {
  pvnBinding: PVNBindingInfo | null
}

export const ConnectionsSettings = ({ pvnBinding }: ConnectionsSettingsProps) => {
  return (
    <div className="flex flex-col gap-4">
      <PVNBinding initialBinding={pvnBinding} />
    </div>
  )
}
