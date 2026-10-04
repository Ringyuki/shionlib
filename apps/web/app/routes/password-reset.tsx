import { PasswordResetPanel } from '~/features/auth'
import type { Route } from './+types/password-reset'

export {
  passwordResetAction as action,
  passwordResetLoader as loader,
} from '~/features/auth/auth.server'

export default function PasswordResetPage({ loaderData }: Route.ComponentProps) {
  return <PasswordResetPanel {...loaderData} />
}
