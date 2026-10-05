import { Alert, Button, Divider, Image, Stack, Text } from '@hina-ui/react'
import { Fingerprint } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { browserApiUrl } from '~/shared/api/browser'
import { authViewParam } from '../auth'
import { usePasskeySignIn } from '../use-passkey-sign-in'

export function SignInMethods() {
  const t = useTranslations('auth.methods')
  const passkey = usePasskeySignIn()
  const problem =
    passkey.failure?.message ?? (passkey.problem === undefined ? undefined : t(passkey.problem))

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
        icon={
          <Image
            src="/brand/hikarinagi-icon.webp"
            alt=""
            eager
            lazy={false}
            skeleton={false}
            fit="cover"
            className="size-5 shrink-0"
          />
        }
        disabled={passkey.pending}
        onClick={signInWithHikarinagi}
        block
      >
        {t('hikarinagi')}
      </Button>
      <Alert tone="danger" open={problem !== undefined}>
        {problem}
      </Alert>
    </Stack>
  )
}
