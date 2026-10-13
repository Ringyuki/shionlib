import {
  Avatar,
  Button,
  DropdownMenu,
  Flex,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Stack,
  Text,
  Tooltip,
  useImageResolver,
} from '@hina-ui/react'
import { Bookmark, ChevronsUpDown, LogIn, LogOut, Settings, Shield, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useLocale, useTranslations } from 'use-intl'
import { useSignOut } from '~/features/auth'
import { isStaff } from '~/features/viewer'
import type { Schema } from '~/shared/api/types'
import { useAuthGate } from '~/shared/ui/auth-gate'
import { adminPath, sitePaths } from '../shell'
import { SidebarLabel } from './sidebar-label'

type AccountMenuProps = {
  viewer: Schema<'UserMeDTO'> | null
  rail: boolean
}

export function AccountMenu({ viewer, rail }: AccountMenuProps) {
  const t = useTranslations('shell')
  const locale = useLocale()
  const navigate = useNavigate()
  const resolveImage = useImageResolver()
  const gate = useAuthGate()
  const { signOut } = useSignOut()
  const paths = sitePaths(locale)

  if (viewer === null) {
    return (
      <Tooltip content={t('signIn')} side="right" disabled={!rail}>
        <Button
          variant="soft"
          block
          aria-label={rail ? t('signIn') : undefined}
          onClick={() => gate.requireSignIn()}
          className="h-10 justify-start gap-3 rounded-lg ps-[11px] font-medium [&_svg]:size-5 [&_svg]:shrink-0"
        >
          <LogIn aria-hidden />
          <SidebarLabel collapsed={rail}>{t('signIn')}</SidebarLabel>
        </Button>
      </Tooltip>
    )
  }

  return (
    <DropdownMenu
      side={rail ? 'right' : 'top'}
      align={rail ? 'end' : 'start'}
      label={t('account')}
      content={
        <>
          <DropdownMenuLabel>{viewer.email}</DropdownMenuLabel>
          <DropdownMenuItem
            icon={<UserRound />}
            onSelect={() => navigate(paths.profile(viewer.id))}
          >
            {t('profile')}
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={<Bookmark />}
            onSelect={() => navigate(`${paths.profile(viewer.id)}/favorites`)}
          >
            {t('nav.favorites')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<Settings />} onSelect={() => navigate(paths.settings)}>
            {t('nav.settings')}
          </DropdownMenuItem>
          {isStaff(viewer) && (
            <DropdownMenuItem icon={<Shield />} onSelect={() => navigate(adminPath)}>
              {t('admin')}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<LogOut />} onSelect={() => void signOut()}>
            {t('signOut')}
          </DropdownMenuItem>
        </>
      }
    >
      <Button asChild variant="ghost" tone="neutral" block>
        <Flex
          as="button"
          align="center"
          gap="none"
          aria-label={rail ? viewer.name : undefined}
          className="h-12 justify-start gap-3 rounded-lg ps-[5px] pe-2"
        >
          <Avatar
            src={viewer.avatar === null ? undefined : resolveImage(viewer.avatar, 'image')}
            name={viewer.name}
            size="md"
            className="shrink-0"
          />
          <Stack
            gap="none"
            aria-hidden={rail || undefined}
            data-collapsed={rail ? '' : undefined}
            className="hn-sidebar-label min-w-0 flex-1 text-start"
          >
            <Text as="span" size="sm" weight="medium" truncate>
              {viewer.name}
            </Text>
            <Text as="span" size="xs" tone="faint" truncate>
              {t('accountHint')}
            </Text>
          </Stack>
          <ChevronsUpDown
            aria-hidden
            data-collapsed={rail ? '' : undefined}
            className="hn-sidebar-label text-faint size-4 shrink-0"
          />
        </Flex>
      </Button>
    </DropdownMenu>
  )
}
