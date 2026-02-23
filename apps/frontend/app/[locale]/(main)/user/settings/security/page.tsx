import { shionlibRequest } from '@/utils/request'
import { User } from '@/interfaces/user/user.interface'
import { SecuritySettings } from '@/components/user/settings/SecuritySettings'
import { LoginRequired } from '@/components/user/settings/LoginRequired'

export default async function UserSecuritySettingsPage() {
  const data = await shionlibRequest({ forceNotThrowError: true }).get<User>('/user/me')
  if (!data.data) {
    return <LoginRequired />
  }
  return <SecuritySettings user={data.data} />
}
