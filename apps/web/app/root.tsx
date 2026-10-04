import { Center, firstPaintRestoreScript, Heading, Toaster, TooltipProvider } from '@hina-ui/react'
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
import { readServerEnv } from '~/shared/config/env.server'
import { htmlLang } from '~/shared/i18n/locale'
import { apiMiddleware } from '~/shared/route/api.server'
import { ImageBaseProvider } from '~/shared/ui/image-base'
import type { Route } from './+types/root'
import './app.css'

export const middleware: Route.MiddlewareFunction[] = [apiMiddleware]

export function loader() {
  return { imageBaseUrl: readServerEnv().imageBaseUrl }
}

export function shouldRevalidate() {
  return false
}

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
        <script dangerouslySetInnerHTML={{ __html: firstPaintRestoreScript() }} />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <ImageBaseProvider base={loaderData.imageBaseUrl}>
      <Outlet />
    </ImageBaseProvider>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500
  return (
    <Center as="main" className="min-h-dvh p-8">
      <Heading level={1} size="2xl">
        {status}
      </Heading>
    </Center>
  )
}
