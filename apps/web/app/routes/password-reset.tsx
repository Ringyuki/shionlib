import { PasswordResetPanel } from '~/features/auth'
import { pageMeta } from '~/shared/seo/seo'
import type { Route } from './+types/password-reset'

export {
  passwordResetAction as action,
  passwordResetLoader as loader,
} from '~/features/auth/auth.server'

export function meta(args: Route.MetaArgs) {
  const [, lang] = args.matches
  return pageMeta(args, { title: lang.loaderData.messages.auth.reset.title, indexable: false })
}

export default function PasswordResetPage({ loaderData }: Route.ComponentProps) {
  return <PasswordResetPanel {...loaderData} />
}
