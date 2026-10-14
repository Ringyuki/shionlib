import { TranslatorPage, translatorHead } from '~/features/translator'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/translator'

export { translatorLoader as loader } from '~/features/translator/translator.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, args.loaderData && translatorHead(args.loaderData, lang.loaderData))
}

export default function TranslatorRoute({ loaderData }: Route.ComponentProps) {
  return <TranslatorPage content={loaderData} />
}
