'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/shionui/Button'
import { Input } from '@/components/shionui/Input'
import { InputNumber } from '@/components/shionui/InputNumber'
import { DatePicker } from '@/components/shionui/DatePicker'
import { Label } from '@/components/shionui/Label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/shionui/Dialog'
import { Switch } from '@/components/shionui/animated/Switch'
import { Checkbox } from '@/components/shionui/Checkbox'
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectValue,
} from '@/components/shionui/MultiSelect'
import { supportedLocales } from '@/config/i18n/supported'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContents,
  TabsContent,
} from '@/components/shionui/animated/Tabs'
import { ImageUpload } from '@/components/common/uploaders/ImageUpload'
import { AD_PLACEMENTS } from '@/constants/ad-placements'
import { createAdminAd, updateAdminAd } from '@/components/admin/hooks/useAdminAds'
import { toast } from 'react-hot-toast'
import type { AdminAdItem, CreateAdPayload, UpdateAdPayload } from '@/interfaces/admin/ad.interface'

const placements = Object.values(AD_PLACEMENTS)

interface AdFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ad?: AdminAdItem
  onSuccess: () => void
}

export function AdFormDialog({ open, onOpenChange, ad, onSuccess }: AdFormDialogProps) {
  const t = useTranslations('Admin.Ads')
  const isEdit = !!ad

  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(ad?.name ?? '')
  const [placement, setPlacement] = useState<string[]>(ad?.placement ?? [])
  const [imageZh, setImageZh] = useState(ad?.image_zh ?? '')
  const [imageJa, setImageJa] = useState(ad?.image_ja ?? '')
  const [imageEn, setImageEn] = useState(ad?.image_en ?? '')
  const [aspect, setAspect] = useState(ad?.aspect ?? '6 / 1')
  const [link, setLink] = useState(ad?.link ?? '')
  const [sort, setSort] = useState<number | null>(ad?.sort ?? 0)
  const [enabled, setEnabled] = useState(ad?.enabled ?? true)
  const [excludeLocales, setExcludeLocales] = useState<string[]>(ad?.exclude_locales ?? [])
  const [startAt, setStartAt] = useState<Date | null>(ad?.start_at ? new Date(ad.start_at) : null)
  const [endAt, setEndAt] = useState<Date | null>(ad?.end_at ? new Date(ad.end_at) : null)

  const toggleExcludeLocale = (locale: string) => {
    setExcludeLocales(prev =>
      prev.includes(locale) ? prev.filter(l => l !== locale) : [...prev, locale],
    )
  }

  const handleSubmit = async () => {
    if (!name.trim() || !placement.length || !imageZh.trim() || !link.trim()) return

    setLoading(true)
    try {
      if (isEdit) {
        const payload: UpdateAdPayload = {
          name: name.trim(),
          placement,
          image_zh: imageZh.trim(),
          image_ja: imageJa.trim() || undefined,
          image_en: imageEn.trim() || undefined,
          aspect: aspect.trim(),
          link: link.trim(),
          exclude_locales: excludeLocales,
          sort: sort ?? 0,
          enabled,
          start_at: startAt ? startAt.toISOString() : undefined,
          end_at: endAt ? endAt.toISOString() : undefined,
        }
        await updateAdminAd(ad.id, payload)
        toast.success(t('adUpdated'))
      } else {
        const payload: CreateAdPayload = {
          name: name.trim(),
          placement,
          image_zh: imageZh.trim(),
          image_ja: imageJa.trim() || undefined,
          image_en: imageEn.trim() || undefined,
          aspect: aspect.trim(),
          link: link.trim(),
          exclude_locales: excludeLocales,
          sort: sort ?? 0,
          enabled,
          start_at: startAt ? startAt.toISOString() : undefined,
          end_at: endAt ? endAt.toISOString() : undefined,
        }
        await createAdminAd(payload)
        toast.success(t('adCreated'))
      }
      onSuccess()
      onOpenChange(false)
    } catch {
      toast.error(isEdit ? t('adUpdateFailed') : t('adCreateFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editAd') : t('createAd')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2 min-w-0">
          <div className="flex flex-col gap-1.5">
            <Label>{t('name')}</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('name')} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('placement')}</Label>
            <MultiSelect value={placement} onValueChange={setPlacement}>
              <MultiSelectTrigger className="w-full">
                <MultiSelectValue placeholder={t('selectPlacement')} />
              </MultiSelectTrigger>
              <MultiSelectContent>
                {placements.map(p => (
                  <MultiSelectItem key={p} value={p}>
                    {p}
                  </MultiSelectItem>
                ))}
              </MultiSelectContent>
            </MultiSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('image')}</Label>
            <Tabs defaultValue="zh">
              <TabsList variant="bordered" scrollable={false}>
                <TabsTrigger value="zh">{t('imageZh')}</TabsTrigger>
                <TabsTrigger value="ja">{t('imageJa')}</TabsTrigger>
                <TabsTrigger value="en">{t('imageEn')}</TabsTrigger>
              </TabsList>
              <TabsContents>
                <TabsContent value="zh">
                  <ImageUpload
                    endpoint="/uploads/small/ad/image"
                    value={imageZh}
                    onUpload={key => setImageZh(key)}
                    onValueChange={setImageZh}
                    selectLabel={t('selectFile')}
                    uploadLabel={t('upload')}
                    onSuccess={() => toast.success(t('uploadSuccess'))}
                    onError={() => toast.error(t('uploadFailed'))}
                    showInput
                    placeholder="https://"
                  />
                </TabsContent>
                <TabsContent value="ja">
                  <ImageUpload
                    endpoint="/uploads/small/ad/image"
                    value={imageJa}
                    onUpload={key => setImageJa(key)}
                    onValueChange={setImageJa}
                    selectLabel={t('selectFile')}
                    uploadLabel={t('upload')}
                    onSuccess={() => toast.success(t('uploadSuccess'))}
                    onError={() => toast.error(t('uploadFailed'))}
                    showInput
                    placeholder="https://"
                  />
                </TabsContent>
                <TabsContent value="en">
                  <ImageUpload
                    endpoint="/uploads/small/ad/image"
                    value={imageEn}
                    onUpload={key => setImageEn(key)}
                    onValueChange={setImageEn}
                    selectLabel={t('selectFile')}
                    uploadLabel={t('upload')}
                    onSuccess={() => toast.success(t('uploadSuccess'))}
                    onError={() => toast.error(t('uploadFailed'))}
                    showInput
                    placeholder="https://"
                  />
                </TabsContent>
              </TabsContents>
            </Tabs>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('aspect')}</Label>
              <Input value={aspect} onChange={e => setAspect(e.target.value)} placeholder="6 / 1" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('sort')}</Label>
              <InputNumber value={sort} onChange={setSort} min={0} step={1} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('link')}</Label>
            <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('startAt')}</Label>
              <DatePicker value={startAt} onChange={setStartAt} clearable />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t('endAt')}</Label>
              <DatePicker value={endAt} onChange={setEndAt} clearable />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('excludeLocales')}</Label>
            <div className="flex items-center gap-4">
              {supportedLocales.map(locale => (
                <label key={locale} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={excludeLocales.includes(locale)}
                    onCheckedChange={() => toggleExcludeLocale(locale)}
                  />
                  {locale.toUpperCase()}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label>{t('enabled')}</Label>
          </div>
        </div>

        <DialogFooter>
          <Button appearance="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            intent="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={!name.trim() || !placement.length || !imageZh.trim() || !link.trim()}
          >
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
