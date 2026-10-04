import { type RouteConfig, index, layout, route } from '@react-router/dev/routes'

export default [
  index('routes/locale-redirect.ts'),
  route('resources/favorites', 'routes/resources.favorites.ts'),
  route(':lang', 'routes/lang.tsx', [
    layout('routes/site.tsx', [
      index('routes/home.tsx'),
      route('game/:id', 'routes/game.tsx'),
      route('*', 'routes/not-found.ts'),
    ]),
  ]),
] satisfies RouteConfig
