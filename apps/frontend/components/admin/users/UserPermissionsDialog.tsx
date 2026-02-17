'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shionui/Dialog'
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from '@/components/shionui/animated/Tabs'
import { Checkbox } from '@/components/shionui/Checkbox'
import { Badge } from '@/components/shionui/Badge'
import { Button } from '@/components/shionui/Button'
import { Skeleton } from '@/components/shionui/Skeleton'
import { AdminPermissionEntity, AdminUserPermissionDetail } from '@/interfaces/admin/user.interface'
import {
  getAdminUserPermissions,
  updateAdminUserPermissions,
} from '@/components/admin/hooks/useAdminUsers'
import { toast } from 'react-hot-toast'
import { cn } from '@/utils/cn'

interface UserPermissionsDialogProps {
  userId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const entityList: { key: AdminPermissionEntity; labelKey: string }[] = [
  { key: 'game', labelKey: 'entityGame' },
  { key: 'character', labelKey: 'entityCharacter' },
  { key: 'developer', labelKey: 'entityDeveloper' },
]

export function UserPermissionsDialog({ userId, open, onOpenChange }: UserPermissionsDialogProps) {
  const t = useTranslations('Admin.Users')
  const [activeEntity, setActiveEntity] = useState<AdminPermissionEntity>('game')
  const [loading, setLoading] = useState(false)
  const [savingEntity, setSavingEntity] = useState<AdminPermissionEntity | null>(null)
  const [data, setData] = useState<Record<AdminPermissionEntity, AdminUserPermissionDetail | null>>(
    {
      game: null,
      character: null,
      developer: null,
    },
  )

  useEffect(() => {
    if (!open || !userId) return
    setLoading(true)
    Promise.all(entityList.map(entity => getAdminUserPermissions(userId, entity.key)))
      .then(results => {
        const next = { game: null, character: null, developer: null } as Record<
          AdminPermissionEntity,
          AdminUserPermissionDetail | null
        >
        results.forEach(result => {
          next[result.entity] = result
        })
        setData(next)
      })
      .catch(() => {
        setData({ game: null, character: null, developer: null })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [open, userId])

  const toggleGroup = (entity: AdminPermissionEntity, bitIndex: number, enabled: boolean) => {
    setData(prev => {
      const current = prev[entity]
      if (!current) return prev
      const groups = current.groups.map(group =>
        group.bitIndex === bitIndex ? { ...group, enabled } : group,
      )
      return { ...prev, [entity]: { ...current, groups } }
    })
  }

  const saveEntity = async (entity: AdminPermissionEntity) => {
    if (!userId) return
    const current = data[entity]
    if (!current) return
    const allowBits = current.groups
      .filter(group => group.mutable && group.enabled)
      .map(group => group.bitIndex)
    setSavingEntity(entity)
    try {
      await updateAdminUserPermissions(userId, entity, allowBits)
      toast.success(t('permissionsUpdated'))
      const refreshed = await getAdminUserPermissions(userId, entity)
      setData(prev => ({ ...prev, [entity]: refreshed }))
    } catch {
    } finally {
      setSavingEntity(null)
    }
  }

  const groupTitle = (field: string) => {
    const key = `permissions.groups.${field}`
    return t(key)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent fitContent className="min-w-full sm:min-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('permissionsTitle')}</DialogTitle>
          <DialogDescription>{t('permissionsDescription')}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <Tabs
            value={activeEntity}
            onValueChange={value => setActiveEntity(value as AdminPermissionEntity)}
          >
            <TabsList>
              {entityList.map(entity => (
                <TabsTrigger key={entity.key} value={entity.key}>
                  {t(entity.labelKey)}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContents>
              {entityList.map(entity => {
                const detail = data[entity.key]
                return (
                  <TabsContent key={entity.key} value={entity.key}>
                    {!detail ? (
                      <div className="text-sm text-muted-foreground">{t('noPermissions')}</div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="neutral">{t('permissionRole')}</Badge>
                          <Badge variant="success">{t('permissionUser')}</Badge>
                          <span>{t('permissionHint')}</span>
                        </div>

                        <div className="space-y-2">
                          {detail.groups.map(group => (
                            <div
                              key={`${entity.key}-${group.bitIndex}`}
                              className={cn(
                                'rounded-lg border p-3',
                                group.enabled ? 'bg-card/50' : '',
                              )}
                            >
                              <div className="flex flex-wrap items-center gap-3">
                                <Checkbox
                                  checked={group.enabled}
                                  disabled={!group.mutable}
                                  onCheckedChange={checked =>
                                    toggleGroup(entity.key, group.bitIndex, Boolean(checked))
                                  }
                                />
                                <div className="flex flex-col gap-1">
                                  <div className="font-medium text-sm">
                                    {groupTitle(group.field)}
                                  </div>
                                  {group.fields.length > 0 ? (
                                    <div className="text-xs text-muted-foreground">
                                      {group.fields.join(', ')}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="ml-auto flex items-center gap-2">
                                  {group.source === 'role' && (
                                    <Badge variant="neutral">{t('permissionRole')}</Badge>
                                  )}
                                  {group.source === 'user' && (
                                    <Badge variant="success">{t('permissionUser')}</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                )
              })}
            </TabsContents>
          </Tabs>
        )}
        <DialogFooter>
          <Button intent="neutral" appearance="ghost" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
          <Button
            intent="primary"
            onClick={() => saveEntity(activeEntity)}
            loading={savingEntity === activeEntity || loading}
          >
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
