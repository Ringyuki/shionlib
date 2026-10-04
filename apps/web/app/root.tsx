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
  useRouteLoaderData,
} from 'react-router'
import { readServerEnv } from '~/shared/config/env.server'
import { htmlLang } from '~/shared/i18n/locale'
import { apiMiddleware } from '~/shared/route/api.server'
import { ImageBaseProvider } from '~/shared/ui/image-base'
import { darkClass, systemThemeScript, themeFrom } from '~/shared/ui/theme'
import { ThemeProvider } from '~/shared/ui/theme-provider'
import type { Route } from './+types/root'
import './app.css'

export const middleware: Route.MiddlewareFunction[] = [apiMiddleware]

export function loader({ request }: Route.LoaderArgs) {
  const env = readServerEnv()
  return {
    imageBaseUrl: env.imageBaseUrl,
    theme: themeFrom(request.headers.get('cookie') ?? ''),
  }
}

export function shouldRevalidate() {
  return false
}

export function Layout({ children }: { children: ReactNode }) {
  const { lang } = useParams()
  const theme = useRouteLoaderData<typeof loader>('root')?.theme ?? 'system'
  return (
    <html
      lang={htmlLang(lang)}
      className={theme === 'dark' ? darkClass : undefined}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {theme === 'system' && <script dangerouslySetInnerHTML={{ __html: systemThemeScript() }} />}
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
    <ThemeProvider initial={loaderData.theme}>
      <ImageBaseProvider base={loaderData.imageBaseUrl}>
        <Outlet />
      </ImageBaseProvider>
    </ThemeProvider>
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
