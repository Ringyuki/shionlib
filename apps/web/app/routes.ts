import { type RouteConfig, index, layout, route } from '@react-router/dev/routes'

export default [
  index('routes/locale-redirect.ts'),
  route('user/password/forget', 'routes/locale-redirect.ts', { id: 'password-reset-locale' }),
  route('resources/favorites', 'routes/resources.favorites.ts'),
  route('resources/auth/sign-in', 'routes/resources.auth.sign-in.ts'),
  route('resources/auth/sign-up', 'routes/resources.auth.sign-up.ts'),
  route('resources/auth/sign-up-code', 'routes/resources.auth.sign-up-code.ts'),
  route('resources/auth/password-reset', 'routes/resources.auth.password-reset.ts'),
  route('resources/auth/passkey-options', 'routes/resources.auth.passkey-options.ts'),
  route('resources/auth/passkey-sign-in', 'routes/resources.auth.passkey-sign-in.ts'),
  route('resources/auth/sign-out', 'routes/resources.auth.sign-out.ts'),
  route('resources/auth/artwork', 'routes/resources.auth.artwork.ts'),
  route(':lang', 'routes/lang.tsx', [
    route('login', 'routes/auth-redirect.ts', { id: 'login' }),
    route('register', 'routes/auth-redirect.ts', { id: 'register' }),
    layout('routes/site.tsx', [
      index('routes/home.tsx'),
      route('user/password/forget', 'routes/password-reset.tsx'),
      route('game/:id', 'routes/game.tsx'),
      route('*', 'routes/not-found.ts'),
    ]),
  ]),
] satisfies RouteConfig
