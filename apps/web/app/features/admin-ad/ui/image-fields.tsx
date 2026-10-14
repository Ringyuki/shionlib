import { Checkbox, FileUpload, FormLayout, Image, Inline, toast } from '@hina-ui/react'
import { ImageUp } from 'lucide-react'
import type { Dispatch, SetStateAction } from 'react'
import { useTranslations } from 'use-intl'
import { pictureTypes } from '~/features/profile'
import { Button } from '~/shared/ui/button'
import { bannerRatio, sideTypes, withImages, type AdValues, type ImageKind } from '../admin-ad'
import { useImageUpload } from '../use-image-upload'

type ImageFieldProps = {
  values: AdValues
  onChange: Dispatch<SetStateAction<AdValues>>
}

function Picker({
  kind,
  accept,
  label,
  onPicked,
}: {
  kind: ImageKind
  accept: string
  label: string
  onPicked: (key: string) => void
}) {
  const t = useTranslations('adminAd.dialog')
  const images = useImageUpload(kind)
  return (
    <FileUpload
      variant="button"
      list={false}
      className="w-auto"
      accept={accept}
      value={null}
      icon={<ImageUp />}
      loading={images.uploading}
      onReject={() => toast.danger(t('unsupported'))}
      onValueChange={file => {
        if (file instanceof File) {
          void images.upload(file).then(key => {
            if (key !== undefined) {
              onPicked(key)
            }
          })
        }
      }}
    >
      {label}
    </FileUpload>
  )
}

export function BannerField({ values, onChange }: ImageFieldProps) {
  const t = useTranslations('adminAd.dialog')
  return (
    <FormLayout legend={t('banner')} description={t('bannerHint')}>
      {values.banner !== null && (
        <Image src={values.banner} alt={t('banner')} ratio={bannerRatio} className="rounded-lg" />
      )}
      <Inline gap="sm" align="center">
        <Picker
          kind="banner"
          accept={pictureTypes}
          label={t(values.banner === null ? 'pickBanner' : 'replace')}
          onPicked={banner => onChange(current => withImages(current, { banner }))}
        />
        {values.banner !== null && (
          <Button
            variant="ghost"
            tone="neutral"
            onClick={() => onChange(current => withImages(current, { banner: null }))}
          >
            {t('removeImage')}
          </Button>
        )}
        <Checkbox
          className="ms-auto"
          checked={values.bannerAdult}
          disabled={values.banner === null}
          onCheckedChange={checked =>
            onChange(current => ({ ...current, bannerAdult: checked === true }))
          }
        >
          {t('adult')}
        </Checkbox>
      </Inline>
    </FormLayout>
  )
}

export function SideField({ values, onChange }: ImageFieldProps) {
  const t = useTranslations('adminAd.dialog')
  const any = values.sideImage !== null || values.sideIcon !== null
  return (
    <FormLayout legend={t('side')} description={t('sideHint')}>
      {any && (
        <Inline gap="md" align="center" wrap={false} className="border-line rounded-lg border p-2">
          <Image
            src={values.sideImage ?? ''}
            alt={t('side')}
            fit="contain"
            className="h-10 min-w-0 flex-1"
            imageClass="object-left"
          />
          <Image src={values.sideIcon ?? ''} alt="" className="size-7 shrink-0 rounded-md" />
        </Inline>
      )}
      <Inline gap="sm" align="center">
        <Picker
          kind="side-image"
          accept={sideTypes}
          label={t(values.sideImage === null ? 'pickSide' : 'replaceSide')}
          onPicked={sideImage => onChange(current => withImages(current, { sideImage }))}
        />
        <Picker
          kind="side-icon"
          accept={pictureTypes}
          label={t(values.sideIcon === null ? 'pickIcon' : 'replaceIcon')}
          onPicked={sideIcon => onChange(current => withImages(current, { sideIcon }))}
        />
        {any && (
          <Button
            variant="ghost"
            tone="neutral"
            onClick={() =>
              onChange(current => withImages(current, { sideImage: null, sideIcon: null }))
            }
          >
            {t('removeImage')}
          </Button>
        )}
        <Checkbox
          className="ms-auto"
          checked={values.sideAdult}
          disabled={values.sideImage === null}
          onCheckedChange={checked =>
            onChange(current => ({ ...current, sideAdult: checked === true }))
          }
        >
          {t('adult')}
        </Checkbox>
      </Inline>
    </FormLayout>
  )
}
