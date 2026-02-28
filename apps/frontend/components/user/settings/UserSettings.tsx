import { User } from '@/interfaces/user/user.interface'
import { AvatarSettings } from '@/components/user/settings/Avatar'
import { NameSettings } from '@/components/user/settings/Name'
import { CoverSettings } from '@/components/user/settings/Cover'
import { BioSettings } from '@/components/user/settings/Bio'

interface UserSettingsProps {
  user: User
}

export const UserSettings = ({ user }: UserSettingsProps) => {
  return (
    <div className="w-full flex flex-col gap-4">
      <AvatarSettings avatar={user.avatar} name={user.name} />
      <CoverSettings cover={user.cover} />
      <BioSettings bio={user.bio} />
      <NameSettings name={user.name} />
    </div>
  )
}
