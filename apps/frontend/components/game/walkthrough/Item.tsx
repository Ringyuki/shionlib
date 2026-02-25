'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation.client'
import { Link } from '@/i18n/navigation.client'
import { Walkthrough, WalkthroughStatus } from '@/interfaces/walkthrough/walkthrough.interface'
import { LanguageNameMap } from '@/interfaces/game/game.interface'
import { Card, CardContent } from '@/components/shionui/Card'
import { Badge } from '@/components/shionui/Badge'
import { Button } from '@/components/shionui/Button'
import { Avatar } from '@/components/common/user/Avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/shionui/DropdownMenu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/shionui/AlertDialog'
import { Ellipsis, Pencil, Trash, Languages } from 'lucide-react'
import { timeFromNow } from '@/utils/time-format'
import { shionlibRequest } from '@/utils/request'
import { useShionlibUserStore } from '@/store/userStore'
import { sileo } from 'sileo'

interface GameWalkthroughItemProps {
  walkthrough: Walkthrough
  gameId: string
}

export const GameWalkthroughItem = ({ walkthrough, gameId }: GameWalkthroughItemProps) => {
  const t = useTranslations('Components.Game.Walkthrough.Item')
  const locale = useLocale()
  const router = useRouter()
  const { user } = useShionlibUserStore()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const canManage = user.id === walkthrough.creator.id || user.role >= 2

  const handleDelete = async () => {
    setDeleteLoading(true)
    try {
      await shionlibRequest().delete(`/walkthrough/${walkthrough.id}`)
      sileo.success({ title: t('delete_success') })
      setDeleteOpen(false)
      router.refresh()
    } catch {
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <>
      <Link href={`/game/${gameId}/walkthrough/${walkthrough.id}`}>
        <Card className="py-0 hover:border-primary/50 transition-colors duration-150">
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-base font-semibold">{walkthrough.title}</span>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild suppressHydrationWarning>
                    <span>
                      <Button
                        intent="secondary"
                        size="icon"
                        className="size-6"
                        appearance="ghost"
                        renderIcon={<Ellipsis />}
                      />
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent onClick={e => e.stopPropagation()}>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/game/${gameId}/walkthrough/edit?walkthrough_id=${walkthrough.id}`,
                        )
                      }
                    >
                      <Pencil />
                      {t('edit')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash />
                      {t('delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Avatar user={walkthrough.creator} className="size-5" />
                <span className="text-sm text-muted-foreground">{walkthrough.creator.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {timeFromNow(walkthrough.created, locale)}
              </span>
              {walkthrough.edited && (
                <span className="text-xs text-muted-foreground">
                  {t('editedAt')} {timeFromNow(walkthrough.updated, locale)}
                </span>
              )}
              {walkthrough.lang && (
                <Badge intent="neutral" className="flex items-center gap-1">
                  <Languages />
                  {LanguageNameMap[walkthrough.lang]}
                </Badge>
              )}
              {walkthrough.status === WalkthroughStatus.DRAFT && (
                <Badge intent="secondary" appearance="solid">
                  {t('draft')}
                </Badge>
              )}
              {walkthrough.status === WalkthroughStatus.HIDDEN && (
                <Badge intent="warning" appearance="solid">
                  {t('hidden')}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </Link>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent tone="destructive">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete_description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel tone="destructive">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              tone="destructive"
              loading={deleteLoading}
              onClick={e => {
                e.preventDefault()
                handleDelete()
              }}
            >
              {t('delete_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
