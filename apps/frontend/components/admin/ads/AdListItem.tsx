'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Badge } from '@/components/shionui/Badge'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { Button } from '@/components/shionui/Button'
import { cn } from '@/utils/cn'
import { MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shionui/DropdownMenu'
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
import { updateAdminAd, deleteAdminAd } from '@/components/admin/hooks/useAdminAds'
import { AdFormDialog } from './AdFormDialog'
import { toast } from 'react-hot-toast'
import type { AdminAdItem } from '@/interfaces/admin/ad.interface'

interface AdListItemProps {
  ad: AdminAdItem
  onRefresh: () => void
}

const formatDate = (value: string | null | undefined, locale: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdListItem({ ad, onRefresh }: AdListItemProps) {
  const t = useTranslations('Admin.Ads')
  const locale = useLocale()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const handleToggleEnabled = async () => {
    try {
      await updateAdminAd(ad.id, { enabled: !ad.enabled })
      toast.success(ad.enabled ? t('adDisabled') : t('adEnabled'))
      onRefresh()
    } catch {
      toast.error(t('adUpdateFailed'))
    }
  }

  const handleDelete = async () => {
    setDeleteLoading(true)
    try {
      await deleteAdminAd(ad.id)
      toast.success(t('adDeleted'))
      onRefresh()
    } catch {
      toast.error(t('adDeleteFailed'))
    } finally {
      setDeleteLoading(false)
      setDeleteOpen(false)
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        'bg-white/50 dark:bg-gray-900/50',
        'border-gray-200 dark:border-gray-800',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100">{ad.name}</span>
            <Badge intent={ad.enabled ? 'success' : 'secondary'} appearance="solid">
              {ad.enabled ? t('enabled') : t('disabled')}
            </Badge>
            {ad.placement.map(p => (
              <Badge key={p} intent="info" appearance="soft">
                {p}
              </Badge>
            ))}
            <Badge intent="neutral" appearance="outline">
              {t('sort')}: {ad.sort}
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            {ad.image_zh && (
              <div className="h-10 w-16 rounded border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
                <FadeImage
                  src={ad.image_zh}
                  alt={ad.name}
                  imageClassName="object-cover h-full w-full"
                />
              </div>
            )}
            <a
              href={ad.link}
              target="_blank"
              rel="noreferrer"
              className="truncate max-w-80 hover:underline text-primary"
            >
              {ad.link}
            </a>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span>ID: #{ad.id}</span>
            <span>
              {t('startAt')}: {formatDate(ad.start_at, locale)}
            </span>
            <span>
              {t('endAt')}: {formatDate(ad.end_at, locale)}
            </span>
            <span>
              {t('createdAt')}: {formatDate(ad.created, locale)}
            </span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button intent="neutral" appearance="ghost" size="icon">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>{t('editAd')}</DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleEnabled}>
              {ad.enabled ? t('toggleDisabled') : t('toggleEnabled')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
              {t('deleteAd')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AdFormDialog open={editOpen} onOpenChange={setEditOpen} ad={ad} onSuccess={onRefresh} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteAdTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteAdDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction tone="destructive" onClick={handleDelete} loading={deleteLoading}>
              {t('confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
