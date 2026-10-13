import { useRouteLoaderData } from 'react-router'
import type { Pending } from './admin'
import type { adminLoader } from './admin.server'

export const adminRouteId = 'routes/admin'

export function usePending(): Pending | undefined {
  return useRouteLoaderData<typeof adminLoader>(adminRouteId)?.pending
}
