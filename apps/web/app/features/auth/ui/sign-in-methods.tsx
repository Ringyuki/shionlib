import { Button, Divider, Stack, Text } from '@hina-ui/react'
import { Fingerprint, KeyRound } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { browserApiUrl } from '~/shared/api/browser'
import { authViewParam } from '../auth'
import { usePasskeySignIn } from '../use-passkey-sign-in'
import { FailureAlert } from '~/shared/ui/failure-alert'

export function SignInMethods() {
  const t = useTranslations('auth.methods')
  const passkey = usePasskeySignIn()
  const problem = passkey.problem === undefined ? undefined : t(passkey.problem)

  const signInWithHikarinagi = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete(authViewParam)
    window.location.assign(
      browserApiUrl('/auth/oidc/start', {
        returnTo: `${url.pathname}${url.search}`,
        origin: url.origin,
      }),
    )
  }

  return (
    <Stack gap="sm">
      <Divider>
        <Text as="span" size="xs" tone="muted">
          {t('divider')}
        </Text>
      </Divider>
      <Button
        variant="outline"
        tone="neutral"
        icon={<Fingerprint />}
        loading={passkey.pending}
        onClick={passkey.start}
        block
      >
        {t('passkey')}
      </Button>
      <Button
        variant="outline"
        tone="neutral"
        icon={<KeyRound />}
        disabled={passkey.pending}
        onClick={signInWithHikarinagi}
        block
      >
        {t('hikarinagi')}
      </Button>
      <FailureAlert message={passkey.failure?.message ?? problem} />
    </Stack>
  )
}
