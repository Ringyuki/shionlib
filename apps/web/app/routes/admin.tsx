import { Outlet } from 'react-router'
import { AdminMessages, adminArea } from '~/features/admin'
import { adminLoader } from '~/features/admin/admin.server'
import { shellAreaHandle } from '~/features/shell'
import { loadAdminMessages } from '~/messages/admin'
import type { Route } from './+types/admin'

export const handle = shellAreaHandle(adminArea)

export function loader(args: Route.LoaderArgs) {
  return adminLoader(args, loadAdminMessages)
}

export default function AdminLayout() {
  return (
    <AdminMessages>
      <Outlet />
    </AdminMessages>
  )
}
