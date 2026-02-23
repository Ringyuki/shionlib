import { User } from '@/interfaces/user/user.interface'
import { PasswordSettings } from '@/components/user/settings/Password'
import { PasskeySettings } from '@/components/user/settings/Passkey'
import { EmailSettings } from '@/components/user/settings/Email'

interface SecuritySettingsProps {
  user: User
}

export const SecuritySettings = ({ user }: SecuritySettingsProps) => {
  return (
    <div className="w-full flex flex-col gap-4">
      <PasswordSettings />
      <PasskeySettings />
      <EmailSettings email={user.email} />
    </div>
  )
}
