'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AdminUserItem } from '@/interfaces/admin/user.interface'
import { cn } from '@/utils/cn'
import { Avatar } from '@/components/common/user/Avatar'
import { Badge } from '@/components/shionui/Badge'
import { Button } from '@/components/shionui/Button'
import { Input } from '@/components/shionui/Input'
import { Textarea } from '@/components/shionui/Textarea'
import { InputNumber } from '@/components/shionui/InputNumber'
import { Checkbox } from '@/components/shionui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shionui/DropdownMenu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shionui/Dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/shionui/AlertDialog'
import {
  adminBanUser,
  adminForceLogout,
  adminResetUserPassword,
  adminUnbanUser,
  adminUpdateUserProfile,
  adminUpdateUserRole,
} from '@/components/admin/hooks/useAdminUsers'
import { UserDetailDialog } from './UserDetailDialog'
import { UserPermissionsDialog } from './UserPermissionsDialog'
import { UserQuotaDialog } from './UserQuotaDialog'
import { toast } from 'react-hot-toast'
import { MoreHorizontal } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shionui/Select'

interface UserListItemProps {
  user: AdminUserItem
  currentRole: number
  currentUserId: number
  onRefresh?: () => void
}

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function UserListItem({ user, currentRole, currentUserId, onRefresh }: UserListItemProps) {
  const t = useTranslations('Admin.Users')
  const locale = useLocale()

  const [detailOpen, setDetailOpen] = useState(false)
  const [permissionsOpen, setPermissionsOpen] = useState(false)
  const [quotaOpen, setQuotaOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [banOpen, setBanOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [forceLogoutOpen, setForceLogoutOpen] = useState(false)
  const [unbanOpen, setUnbanOpen] = useState(false)

  const [isBusy, setIsBusy] = useState(false)

  const roleLabel = useMemo(() => {
    switch (user.role) {
      case 1:
        return t('roleUser')
      case 2:
        return t('roleAdmin')
      case 3:
        return t('roleSuperAdmin')
      default:
        return String(user.role)
    }
  }, [user.role, t])

  const statusLabel = user.status === 2 ? t('banned') : t('active')

  const canManageRole = currentRole === 3 && user.id !== currentUserId
  const canManageUser = user.id !== currentUserId && currentRole >= user.role

  const [editName, setEditName] = useState(user.name)
  const [editEmail, setEditEmail] = useState(user.email)
  const [editLang, setEditLang] = useState(user.lang)
  const [editContentLimit, setEditContentLimit] = useState<number | undefined>(user.content_limit)

  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState<number | null>(7)
  const [banPermanent, setBanPermanent] = useState(false)
  const [banDeleteComments, setBanDeleteComments] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')

  const [nextRole, setNextRole] = useState(user.role)

  useEffect(() => {
    if (!editOpen) return
    setEditName(user.name)
    setEditEmail(user.email)
    setEditLang(user.lang)
    setEditContentLimit(user.content_limit)
  }, [editOpen, user])

  useEffect(() => {
    if (!banOpen) return
    setBanReason('')
    setBanDuration(7)
    setBanPermanent(false)
    setBanDeleteComments(false)
  }, [banOpen])

  useEffect(() => {
    if (!resetOpen) return
    setNewPassword('')
    setNewPasswordConfirm('')
  }, [resetOpen])

  useEffect(() => {
    if (!roleOpen) return
    setNextRole(user.role)
  }, [roleOpen, user.role])

  const handleEditProfile = async () => {
    setIsBusy(true)
    try {
      await adminUpdateUserProfile(user.id, {
        name: editName?.trim() || undefined,
        email: editEmail?.trim() || undefined,
        lang: editLang,
        content_limit: editContentLimit,
      })
      toast.success(t('updated'))
      setEditOpen(false)
      onRefresh?.()
    } catch {
    } finally {
      setIsBusy(false)
    }
  }

  const handleChangeRole = async () => {
    setIsBusy(true)
    try {
      await adminUpdateUserRole(user.id, nextRole)
      toast.success(t('updatedSuccess'))
      setRoleOpen(false)
      onRefresh?.()
    } catch {
    } finally {
      setIsBusy(false)
    }
  }

  const handleBan = async () => {
    setIsBusy(true)
    try {
      await adminBanUser(user.id, {
        banned_reason: banReason.trim() || undefined,
        banned_duration_days: banPermanent ? undefined : (banDuration ?? undefined),
        is_permanent: banPermanent || undefined,
        delete_user_comments: banDeleteComments || undefined,
      })
      toast.success(t('bannedSuccess'))
      setBanOpen(false)
      onRefresh?.()
    } catch {
    } finally {
      setIsBusy(false)
    }
  }

  const handleUnban = async () => {
    setIsBusy(true)
    try {
      await adminUnbanUser(user.id)
      toast.success(t('unbannedSuccess'))
      setUnbanOpen(false)
      onRefresh?.()
    } catch {
    } finally {
      setIsBusy(false)
    }
  }

  const handleResetPassword = async () => {
    if (!newPassword || newPassword !== newPasswordConfirm) return
    setIsBusy(true)
    try {
      await adminResetUserPassword(user.id, newPassword)
      toast.success(t('passwordResetSuccess'))
      setResetOpen(false)
      setNewPassword('')
      setNewPasswordConfirm('')
    } catch {
    } finally {
      setIsBusy(false)
    }
  }

  const handleForceLogout = async () => {
    setIsBusy(true)
    try {
      await adminForceLogout(user.id)
      toast.success(t('forceLogoutSuccess'))
      setForceLogoutOpen(false)
    } catch {
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg border p-4 transition-colors',
        'bg-white/50 dark:bg-gray-900/50',
        'border-gray-200 dark:border-gray-800',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      )}
    >
      <Avatar
        clickable={false}
        user={{ id: user.id, name: user.name, avatar: user.avatar ?? '' }}
        className="size-12"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-gray-900 dark:text-gray-100">{user.name}</span>
          <Badge variant={user.status === 2 ? 'warning' : 'success'}>{statusLabel}</Badge>
          <Badge variant="neutral">{roleLabel}</Badge>
          {user.two_factor_enabled ? (
            <Badge variant="success">2FA</Badge>
          ) : (
            <Badge variant="neutral">2FA</Badge>
          )}
        </div>
        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
          <span>
            {t('lastLogin')}: {formatDate(user.last_login_at, locale)}
          </span>
          <span>
            {t('created')}: {formatDate(user.created, locale)}
          </span>
          <span>
            {t('updated')}: {formatDate(user.updated, locale)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {t('countResources')}: {user.counts.resources}
          </span>
          <span>
            {t('countComments')}: {user.counts.comments}
          </span>
          <span>
            {t('countFavorites')}: {user.counts.favorites}
          </span>
          <span>
            {t('countEdits')}: {user.counts.edits}
          </span>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button intent="neutral" appearance="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setDetailOpen(true)}>{t('viewDetail')}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPermissionsOpen(true)} disabled={!canManageUser}>
            {t('editPermissions')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuotaOpen(true)} disabled={!canManageUser}>
            {t('manageQuota')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditOpen(true)} disabled={!canManageUser}>
            {t('editProfile')}
          </DropdownMenuItem>
          {canManageRole && (
            <DropdownMenuItem onClick={() => setRoleOpen(true)}>{t('changeRole')}</DropdownMenuItem>
          )}
          {user.status === 2 ? (
            <DropdownMenuItem onClick={() => setUnbanOpen(true)} disabled={!canManageUser}>
              {t('unbanUser')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setBanOpen(true)} disabled={!canManageUser}>
              {t('banUser')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setForceLogoutOpen(true)} disabled={!canManageUser}>
            {t('forceLogout')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResetOpen(true)} disabled={!canManageUser}>
            {t('resetPassword')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UserDetailDialog
        userId={detailOpen ? user.id : null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <UserPermissionsDialog
        userId={permissionsOpen ? user.id : null}
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
      />
      <UserQuotaDialog
        userId={quotaOpen ? user.id : null}
        open={quotaOpen}
        onOpenChange={setQuotaOpen}
        onUpdated={onRefresh}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editProfile')}</DialogTitle>
            <DialogDescription>{t('editProfileDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder={t('name')}
            />
            <Input
              value={editEmail}
              onChange={e => setEditEmail(e.target.value)}
              placeholder={t('email')}
            />
            <Select value={editLang} onValueChange={value => setEditLang(value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('language')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="zh">简体中文</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
              </SelectContent>
            </Select>
            <InputNumber
              value={editContentLimit}
              onChange={value => setEditContentLimit(value ?? undefined)}
              min={1}
              max={3}
              clampOnBlur
            />
          </div>
          <DialogFooter>
            <Button intent="neutral" appearance="ghost" onClick={() => setEditOpen(false)}>
              {t('cancel')}
            </Button>
            <Button intent="primary" onClick={handleEditProfile} loading={isBusy}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('changeRole')}</DialogTitle>
            <DialogDescription>{t('changeRoleDesc')}</DialogDescription>
          </DialogHeader>
          <Select value={String(nextRole)} onValueChange={value => setNextRole(parseInt(value))}>
            <SelectTrigger>
              <SelectValue placeholder={t('role')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{t('roleUser')}</SelectItem>
              <SelectItem value="2">{t('roleAdmin')}</SelectItem>
              <SelectItem value="3">{t('roleSuperAdmin')}</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button intent="neutral" appearance="ghost" onClick={() => setRoleOpen(false)}>
              {t('cancel')}
            </Button>
            <Button intent="primary" onClick={handleChangeRole} loading={isBusy}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('banUser')}</DialogTitle>
            <DialogDescription>{t('banUserDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={banReason}
              onChange={e => setBanReason(e.target.value)}
              placeholder={t('banReason')}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                checked={banPermanent}
                onCheckedChange={checked => setBanPermanent(Boolean(checked))}
              />
              <span className="text-sm">{t('permanentBan')}</span>
            </div>
            <InputNumber
              value={banDuration}
              onChange={value => setBanDuration(value)}
              min={1}
              max={999}
              disabled={banPermanent}
              placeholder={t('banDuration')}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                checked={banDeleteComments}
                onCheckedChange={checked => setBanDeleteComments(Boolean(checked))}
              />
              <span className="text-sm">{t('deleteComments')}</span>
            </div>
          </div>
          <DialogFooter>
            <Button intent="neutral" appearance="ghost" onClick={() => setBanOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              intent="warning"
              onClick={handleBan}
              loading={isBusy}
              disabled={!banPermanent && (!banDuration || banDuration <= 0)}
            >
              {t('confirmBan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={unbanOpen} onOpenChange={setUnbanOpen}>
        <AlertDialogContent tone="warning">
          <AlertDialogHeader>
            <AlertDialogTitle tone="warning">{t('unbanUser')}</AlertDialogTitle>
            <AlertDialogDescription>{t('unbanConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction tone="warning" onClick={handleUnban} loading={isBusy}>
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('resetPassword')}</DialogTitle>
            <DialogDescription>{t('resetPasswordDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder={t('newPassword')}
              autoComplete="off"
            />
            <Input
              type="password"
              value={newPasswordConfirm}
              onChange={e => setNewPasswordConfirm(e.target.value)}
              placeholder={t('confirmPassword')}
              autoComplete="off"
            />
            {newPassword && newPasswordConfirm && newPassword !== newPasswordConfirm ? (
              <div className="text-xs text-destructive">{t('passwordMismatch')}</div>
            ) : null}
          </div>
          <DialogFooter>
            <Button intent="neutral" appearance="ghost" onClick={() => setResetOpen(false)}>
              {t('cancel')}
            </Button>
            <Button
              intent="warning"
              onClick={handleResetPassword}
              loading={isBusy}
              disabled={!newPassword || newPassword !== newPasswordConfirm}
            >
              {t('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={forceLogoutOpen} onOpenChange={setForceLogoutOpen}>
        <AlertDialogContent tone="warning">
          <AlertDialogHeader>
            <AlertDialogTitle tone="warning">{t('forceLogout')}</AlertDialogTitle>
            <AlertDialogDescription>{t('forceLogoutDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction tone="warning" onClick={handleForceLogout} loading={isBusy}>
              {t('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
