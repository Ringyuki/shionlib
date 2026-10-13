import { TranslatorPage } from '~/features/translator'
import type { Route } from './+types/translator'

export { translatorLoader as loader } from '~/features/translator/translator.server'

export function meta({ loaderData }: Route.MetaArgs) {
  return loaderData === undefined ? [] : [{ title: `${loaderData.translator.name} | Shionlib` }]
}

export default function TranslatorRoute({ loaderData }: Route.ComponentProps) {
  return <TranslatorPage content={loaderData} />
}
