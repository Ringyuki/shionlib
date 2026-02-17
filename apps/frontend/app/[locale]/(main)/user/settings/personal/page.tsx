import { shionlibRequest } from '@/utils/request'
import { User } from '@/interfaces/user/user.interface'
import { UserSettings } from '@/components/user/settings/UserSettings'
import { LoginRequired } from '@/components/user/settings/LoginRequired'

export default async function UserPersonalSettingsPage() {
  const data = await shionlibRequest({ forceNotThrowError: true }).get<User>('/user/me')
  if (!data.data) {
    return <LoginRequired />
  }
  return <UserSettings user={data.data} />
}
