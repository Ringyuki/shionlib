import {
  Alert,
  CloseButton,
  Dialog,
  Heading,
  Inline,
  ScrollArea,
  Stack,
  Text,
} from '@hina-ui/react'
import type { ReactNode } from 'react'
import { useTranslations } from 'use-intl'
import { AuthGateProvider, type AuthGate } from '~/shared/ui/auth-gate'
import { BrandLogo, Wordmark } from '~/shared/ui/brand'
import type { AuthView } from '../auth'
import { useArtwork } from '../use-artwork'
import { useAuthDialog } from '../use-auth-dialog'
import { AuthArtwork } from './auth-artwork'
import { ForgotPasswordForm } from './forgot-password-form'
import { SignInForm } from './sign-in-form'
import { SignUpFormView } from './sign-up-form'

export function AuthDialogProvider({
  signedIn,
  children,
}: {
  signedIn: boolean
  children: ReactNode
}) {
  const dialog = useAuthDialog(signedIn)
  const gate: AuthGate = {
    signedIn,
    requireSignIn: resume => dialog.show('sign-in', resume),
  }
  return (
    <AuthGateProvider gate={gate}>
      {children}
      <AuthDialog
        open={dialog.open}
        view={dialog.view}
        oidcFailed={dialog.oidcFailed}
        onSwitch={dialog.switchTo}
        onClose={dialog.close}
      />
    </AuthGateProvider>
  )
}

type AuthDialogProps = {
  open: boolean
  view: AuthView
  oidcFailed: boolean
  onSwitch: (view: AuthView) => void
  onClose: () => void
}

function AuthDialog({ open, view, oidcFailed, onSwitch, onClose }: AuthDialogProps) {
  const t = useTranslations('auth')
  const artwork = useArtwork(open)
  return (
    <Dialog
      title={t(`${view}.title`)}
      description={t(`${view}.description`)}
      open={open}
      onOpenChange={next => {
        if (!next) {
          onClose()
        }
      }}
      size="2xl"
      className="max-w-[52rem] md:h-[40rem]"
      renderBody={({ close }) => (
        <Inline gap="none" align="stretch" wrap={false} className="relative h-full min-h-0">
          <AuthArtwork artwork={artwork} className="hidden aspect-[2/3] h-full shrink-0 md:flex" />
          <ScrollArea className="min-h-0 min-w-0 flex-1">
            <Stack gap="lg" className="px-6 py-8 sm:px-10">
              <Stack gap="md">
                <Inline gap="sm" align="center" wrap={false}>
                  <BrandLogo className="size-8" />
                  <Wordmark className="h-5" />
                </Inline>
                <Stack gap="xs" aria-hidden>
                  <Heading level={2} size="xl" weight="semibold">
                    {t(`${view}.title`)}
                  </Heading>
                  <Text size="sm" tone="muted">
                    {t(`${view}.description`)}
                  </Text>
                </Stack>
              </Stack>
              <Alert tone="danger" open={oidcFailed && view === 'sign-in'}>
                {t('methods.oidcFailed')}
              </Alert>
              {view === 'sign-in' && <SignInForm key="sign-in" onSwitch={onSwitch} />}
              {view === 'sign-up' && <SignUpFormView key="sign-up" onSwitch={onSwitch} />}
              {view === 'forgot-password' && (
                <ForgotPasswordForm key="forgot-password" onSwitch={onSwitch} />
              )}
            </Stack>
          </ScrollArea>
          <CloseButton label={t('close')} onClick={close} className="absolute end-3 top-3" />
        </Inline>
      )}
    />
  )
}
