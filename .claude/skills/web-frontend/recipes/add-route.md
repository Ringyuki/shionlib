# Add a page

1. Add the route to `app/routes.ts` inside the `site` layout (or another layout under `:lang`), pointing at `routes/<page>.tsx`.
2. Run `pnpm typecheck` once so `./+types/<page>` exists.
3. Write the module:

```tsx
import { GameHeader, loadGameHeader } from '~/features/game'
import { idParam } from '~/shared/route/params'
import { routeLoader } from '~/shared/route/route.server'
import type { Route } from './+types/game'

export function loader(args: Route.LoaderArgs) {
  const id = idParam(args.params.id)
  return routeLoader(args, async api => ({ game: await loadGameHeader(api, id) }))
}

export function meta({ loaderData, params }: Route.MetaArgs) { ... }

export default function GameRoute({ loaderData }: Route.ComponentProps) {
  return <GameHeader game={loaderData.game} />
}
```

4. Load independent data in parallel (`Promise.all`) inside the one `routeLoader` call.
5. Compose features in the component (pass one feature's component as a prop/slot of another) instead of making features import each other.
6. Add `meta`, and check the page renders server-side: `curl -s localhost:<port>/zh/<path>`.
