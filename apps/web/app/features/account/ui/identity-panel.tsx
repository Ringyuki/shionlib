import { AlertDialog, Image, Inline, Panel, Stack, Text, toast } from '@hina-ui/react'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'use-intl'
import { browserApiUrl } from '~/shared/api/browser'
import { Button } from '~/shared/ui/button'
import type { Identities, Identity } from '../account'
import { useIdentityRemoval } from '../use-connections'

export function IdentityPanel({ identities }: { identities: Identities }) {
  const t = useTranslations('account.identity')
  const format = useFormatter()
  const removal = useIdentityRemoval()
  const [picked, setPicked] = useState<Identity>()
  const [removing, setRemoving] = useState(false)
  const items = identities.items ?? []
  const link = () => {
    const { pathname, origin } = window.location
    window.location.assign(
      browserApiUrl('/auth/oidc/start', { mode: 'link', returnTo: pathname, origin }),
    )
  }
  return (
    <Panel
      title={t('title')}
      description={t('hint')}
      icon={
        <Image
          src="/brand/hikarinagi-icon.webp"
          alt=""
          eager
          lazy={false}
          skeleton={false}
          fit="cover"
          className="size-5 shrink-0 rounded-md"
        />
      }
      actions={
        items.length === 0 && (
          <Button size="sm" variant="outline" tone="neutral" onClick={link}>
            {t('link')}
          </Button>
        )
      }
    >
      <Stack gap="sm">
        {items.map(identity => (
          <Inline key={identity.id} gap="md" align="center" justify="between" wrap={false}>
            <Stack gap="none" className="min-w-0">
              <Text truncate>{identity.email_at_link ?? t('linkedAccount')}</Text>
              <Text size="xs" tone="muted">
                {t('linkedAt', {
                  date: format.dateTime(new Date(identity.created), { dateStyle: 'medium' }),
                })}
              </Text>
            </Stack>
            <Button
              size="sm"
              variant="outline"
              tone="danger"
              disabled={!identities.can_unlink}
              onClick={() => {
                setPicked(identity)
                setRemoving(true)
              }}
              className="shrink-0"
            >
              {t('unlink')}
            </Button>
          </Inline>
        ))}
        {items.length > 0 && !identities.can_unlink && (
          <Text size="sm" tone="muted">
            {t('lastMethod')}
          </Text>
        )}
      </Stack>
      <AlertDialog
        title={t('unlinkConfirm')}
        description={t('unlinkDescription')}
        confirmText={t('unlink')}
        cancelText={t('cancel')}
        tone="danger"
        open={removing}
        onOpenChange={setRemoving}
        onConfirm={async () => {
          if (picked !== undefined) {
            await removal.confirm(picked.id)
            toast.success(t('unlinked'))
          }
        }}
      />
    </Panel>
  )
}
