import { User } from '@/interfaces/user/user.interface'
import { AvatarSettings } from '@/components/user/settings/Avatar'
import { NameSettings } from '@/components/user/settings/Name'
import { PasswordSettings } from '@/components/user/settings/Password'
import { EmailSettings } from '@/components/user/settings/Email'

interface UserSettingsProps {
  user: User
}

export const UserSettings = ({ user }: UserSettingsProps) => {
  return (
    <div className="w-full flex flex-col gap-4">
      <AvatarSettings avatar={user.avatar} name={user.name} />
      <NameSettings name={user.name} />
      <PasswordSettings />
      <EmailSettings email={user.email} />
    </div>
  )
}
