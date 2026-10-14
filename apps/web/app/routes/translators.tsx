import { adPage } from '~/features/ad'
import { TranslatorsPage } from '~/features/translator'
import type { Route } from './+types/translators'
import { pageMeta } from '~/shared/seo/seo'

export const handle = adPage

export { translatorsLoader as loader } from '~/features/translator/translator.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.translator.title })
}

export default function TranslatorsRoute({ loaderData }: Route.ComponentProps) {
  return <TranslatorsPage translators={loaderData} />
}
