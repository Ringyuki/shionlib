import {
  Center,
  Code,
  CodeBlock,
  Heading,
  ImageResolverProvider,
  Stack,
  Text,
  Toaster,
  TooltipProvider,
} from '@hina-ui/react'
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
import { PublicConfigProvider } from '~/shared/config/public-config'
import { htmlLang } from '~/shared/i18n/locale.schema'
import { apiMiddleware } from '~/shared/route/api.server'
import { answerEveryRequest } from '~/shared/route/client-middleware'
import { describe } from '~/shared/route/refusal'
import { failureOf } from '~/shared/ui/error-details'
import { imageResolver } from '~/shared/ui/image-resolver'
import { darkClass, systemThemeScript } from '~/shared/ui/theme'
import { themeFrom } from '~/shared/ui/theme.schema'
import { ThemeProvider } from '~/shared/ui/theme-provider'
import type { Route } from './+types/root'
import './app.css'

export const middleware: Route.MiddlewareFunction[] = [apiMiddleware]

export const clientMiddleware: Route.ClientMiddlewareFunction[] = [answerEveryRequest]

export function loader({ request }: Route.LoaderArgs) {
  return {
    publicConfig: readServerEnv().publicConfig,
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
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <ThemeProvider initial={loaderData.theme}>
      <PublicConfigProvider config={loaderData.publicConfig}>
        <ImageResolverProvider resolver={imageResolver(loaderData.publicConfig.imageBaseUrl)}>
          <Outlet />
        </ImageResolverProvider>
      </PublicConfigProvider>
    </ThemeProvider>
  )
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500
  const failure = failureOf(error)
  const thrown = error instanceof Error ? error : undefined
  return (
    <Center as="main" className="min-h-dvh p-8">
      <Stack gap="md" align="center" className="w-full max-w-2xl">
        <Heading level={1} size="2xl">
          {status}
        </Heading>
        <Text tone="muted">{failure?.message ?? describe(error)}</Text>
        {failure !== undefined && <Code>{failure.requestId}</Code>}
        {thrown?.stack !== undefined && <CodeBlock code={thrown.stack} className="w-full" />}
      </Stack>
    </Center>
  )
}
