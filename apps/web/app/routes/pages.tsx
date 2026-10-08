import { Outlet } from 'react-router'
import { ErrorPage } from '~/shared/ui/error-page'
import type { Route } from './+types/pages'

export default function Pages() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <ErrorPage error={error} />
}
