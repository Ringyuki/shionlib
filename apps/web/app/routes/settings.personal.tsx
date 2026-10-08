import { PersonalSection } from '~/features/settings'
import type { Route } from './+types/settings.personal'

export default function SettingsPersonalRoute({ matches }: Route.ComponentProps) {
  const [, , site] = matches
  const { viewer } = site.loaderData
  return viewer === null ? null : <PersonalSection viewer={viewer} />
}
