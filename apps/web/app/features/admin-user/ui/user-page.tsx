import { AlertDialog, Grid, Link, Stack, toast } from '@hina-ui/react'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router'
import { useTranslations } from 'use-intl'
import { adminPaths } from '~/features/admin'
import type { Viewer } from '~/features/viewer'
import { canChangeRole, canManage, canPunish, type Opened } from '../admin-user'
import { useUserChange } from '../use-user-change'
import { AccountPanel } from './account-panel'
import { BanDialog } from './ban-dialog'
import { RolePanel } from './role-panel'
import { SessionsPanel } from './sessions-panel'
import { BadgePanel, RecordsPanel } from './side-panels'
import { UploadPanel } from './upload-panel'
import { BadgeDialog, PasswordDialog } from './user-dialogs'
import { UserHead } from './user-head'

type UserPageProps = {
  opened: Opened
  viewer: Viewer | null
}

type Asked = 'ban' | 'unban' | 'password' | 'badge'

export function UserPage({ opened, viewer }: UserPageProps) {
  const t = useTranslations('adminUser')
  const shared = useTranslations('admin')
  const [asked, setAsked] = useState<Asked>()
  const change = useUserChange()
  const { detail } = opened
  const acting = viewer ?? { id: 0, role: 0 }
  const manageable = canManage(acting, detail)
  const punishable = canPunish(acting, detail)
  const closing = (kind: Asked) => (open: boolean) => setAsked(open ? kind : undefined)
  return (
    <Stack gap="lg">
      <Link asChild className="inline-flex items-center gap-1.5 self-start">
        <RouterLink to={adminPaths.users} prefetch="intent">
          <ArrowLeft aria-hidden className="size-4" />
          {t('title')}
        </RouterLink>
      </Link>
      <UserHead
        detail={detail}
        punishable={punishable}
        onBan={() => setAsked('ban')}
        onUnban={() => setAsked('unban')}
      />
      <Grid gap="none" className="items-start gap-6 xl:grid-cols-[minmax(0,1fr)_23.75rem]">
        <Stack gap="lg" className="min-w-0">
          <AccountPanel
            key={detail.updated}
            detail={detail}
            manageable={manageable}
            punishable={punishable}
            onResetPassword={() => setAsked('password')}
          />
          <UploadPanel detail={detail} ladder={opened.ladder} manageable={manageable} />
          <SessionsPanel
            detail={detail}
            sessions={opened.sessions}
            total={opened.liveSessions}
            manageable={manageable}
          />
        </Stack>
        <Stack gap="lg" className="min-w-0">
          <RecordsPanel detail={detail} records={opened.records} />
          <BadgePanel detail={detail} onEdit={() => setAsked('badge')} />
          <RolePanel detail={detail} changeable={canChangeRole(acting, detail)} />
        </Stack>
      </Grid>
      <BanDialog detail={detail} open={asked === 'ban'} onOpenChange={closing('ban')} />
      <PasswordDialog
        detail={detail}
        open={asked === 'password'}
        onOpenChange={closing('password')}
      />
      <BadgeDialog detail={detail} open={asked === 'badge'} onOpenChange={closing('badge')} />
      <AlertDialog
        title={t('head.unbanConfirm', { name: detail.name })}
        description={t('head.unbanHint')}
        confirmText={t('head.unban')}
        cancelText={shared('cancel')}
        open={asked === 'unban'}
        onOpenChange={closing('unban')}
        onConfirm={async () => {
          await change.confirm({ action: 'unban', id: detail.id })
          toast.success(t('head.unbanned', { name: detail.name }))
        }}
      />
    </Stack>
  )
}
