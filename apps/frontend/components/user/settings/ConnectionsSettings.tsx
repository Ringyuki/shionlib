import { PVNBinding } from '@/components/user/settings/connections/PVNBinding'
import { HikarinagiConnection } from '@/components/user/settings/connections/HikarinagiConnection'
import { PVNBindingInfo } from '@/interfaces/potatovn/potatovn-binding.interface'

interface ConnectionsSettingsProps {
  pvnBinding: PVNBindingInfo | null
}

export const ConnectionsSettings = ({ pvnBinding }: ConnectionsSettingsProps) => {
  return (
    <div className="flex flex-col gap-4">
      <HikarinagiConnection />
      <PVNBinding initialBinding={pvnBinding} />
    </div>
  )
}
