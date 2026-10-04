import { Toaster, TooltipProvider } from '@hina-ui/react'
import type { ReactNode } from 'react'
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useParams,
} from 'react-router'
import { htmlLang } from '~/shared/i18n/locale'
import { apiMiddleware } from '~/shared/route/api.server'
import type { Route } from './+types/root'
import './app.css'

export const middleware: Route.MiddlewareFunction[] = [apiMiddleware]

export function Layout({ children }: { children: ReactNode }) {
  const { lang } = useParams()
  return (
    <html lang={htmlLang(lang)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500
  return (
    <main className="grid min-h-screen place-items-center p-8 text-center">
      <p className="text-4xl font-semibold">{status}</p>
    </main>
  )
}
