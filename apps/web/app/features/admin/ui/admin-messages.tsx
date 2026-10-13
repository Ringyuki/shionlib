import type { ReactNode } from 'react'
import { useRouteLoaderData } from 'react-router'
import { ExtraMessages } from '~/shared/i18n/extra-messages'
import type { adminLoader } from '../admin.server'
import { adminRouteId } from '../use-admin-area'

export function AdminMessages({ children }: { children: ReactNode }) {
  const area = useRouteLoaderData<typeof adminLoader>(adminRouteId)
  return <ExtraMessages messages={area?.messages}>{children}</ExtraMessages>
}
