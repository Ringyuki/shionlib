import { shionlibRequest } from '@/utils/request'
import { ConnectionsSettings } from '@/components/user/settings/ConnectionsSettings'
import { LoginRequired } from '@/components/user/settings/LoginRequired'
import { PVNBindingInfo } from '@/interfaces/potatovn/potatovn-binding.interface'

export default async function UserConnectionsSettingsPage() {
  const meRes = await shionlibRequest({ forceNotThrowError: true }).get('/user/me')
  if (!meRes.data) {
    return <LoginRequired />
  }
  const pvnRes = await shionlibRequest({ forceNotThrowError: true }).get<PVNBindingInfo>(
    '/potatovn/binding',
  )

  return <ConnectionsSettings pvnBinding={pvnRes.data ?? null} />
}
