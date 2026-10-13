import { Panel, Text } from '@hina-ui/react'
import { LogOut, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslations } from 'use-intl'
import { useSignOut } from '~/features/auth'
import type { Viewer } from '~/features/viewer'
import { Button } from '~/shared/ui/button'
import type { Security } from '../account'
import { EmailDialog } from './email-dialog'
import { PasskeyDialog } from './passkey-dialog'
import { PasskeyList } from './passkey-list'
import { PasswordDialog } from './password-dialog'

type Opened = 'email' | 'password' | 'passkey' | undefined

type SecuritySectionProps = {
  viewer: Viewer
  security: Security
}

export function SecuritySection({ viewer, security }: SecuritySectionProps) {
  const t = useTranslations('account')
  const [opened, setOpened] = useState<Opened>()
  const { signOut, pending } = useSignOut()
  const toggle = (dialog: Exclude<Opened, undefined>) => (open: boolean) =>
    setOpened(open ? dialog : undefined)
  const change = (dialog: Exclude<Opened, undefined>) => (
    <Button size="sm" variant="outline" tone="neutral" onClick={() => setOpened(dialog)}>
      {t('change')}
    </Button>
  )
  return (
    <>
      <Panel title={t('email.panel')} actions={change('email')}>
        <Text className="break-all">{viewer.email}</Text>
      </Panel>
      <Panel
        title={t('password.panel')}
        description={t('password.panelHint')}
        actions={change('password')}
      />
      <Panel
        title={t('passkey.title')}
        description={t('passkey.hint')}
        actions={
          <Button
            size="sm"
            variant="outline"
            tone="neutral"
            icon={<Plus />}
            onClick={() => setOpened('passkey')}
          >
            {t('passkey.add')}
          </Button>
        }
      >
        <PasskeyList passkeys={security.passkeys} />
      </Panel>
      <Panel
        title={t('signOut.title')}
        description={t('signOut.hint')}
        actions={
          <Button
            size="sm"
            variant="outline"
            tone="danger"
            icon={<LogOut />}
            loading={pending}
            onClick={() => void signOut()}
          >
            {t('signOut.action')}
          </Button>
        }
      />
      <EmailDialog
        current={viewer.email}
        open={opened === 'email'}
        onOpenChange={toggle('email')}
      />
      <PasswordDialog open={opened === 'password'} onOpenChange={toggle('password')} />
      <PasskeyDialog open={opened === 'passkey'} onOpenChange={toggle('passkey')} />
    </>
  )
}
