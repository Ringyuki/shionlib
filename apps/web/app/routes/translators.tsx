import { TranslatorsPage } from '~/features/translator'
import type { Route } from './+types/translators'

export { translatorsLoader as loader } from '~/features/translator/translator.server'

export function meta({ matches }: Route.MetaArgs) {
  const [, lang] = matches
  return [{ title: `${lang.loaderData.messages.translator.title} | Shionlib` }]
}

export default function TranslatorsRoute({ loaderData }: Route.ComponentProps) {
  return <TranslatorsPage translators={loaderData} />
}
