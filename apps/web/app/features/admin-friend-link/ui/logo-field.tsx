import { Avatar, FileUpload, Inline, Text, toast, useImageResolver } from '@hina-ui/react'
import { ImageUp } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { pictureTypes } from '~/features/profile'
import { Button } from '~/shared/ui/button'
import { useLogoUpload } from '../use-logo-upload'

type LogoFieldProps = {
  name: string
  logo: string | null
  disabled: boolean
  onChange: (logo: string | null) => void
}

export function LogoField({ name, logo, disabled, onChange }: LogoFieldProps) {
  const t = useTranslations('adminFriendLink.dialog')
  const resolveImage = useImageResolver()
  const logos = useLogoUpload()
  return (
    <Inline
      gap="md"
      align="center"
      wrap={false}
      className="border-line bg-subtle rounded-lg border border-dashed p-3"
    >
      <Avatar
        size="lg"
        name={name.trim() === '' ? undefined : name}
        src={logo === null ? undefined : resolveImage(logo, 'image')}
        className="shrink-0"
      />
      <Text as="span" size="sm" tone="muted" className="min-w-0 flex-1">
        {t('logoHint')}
      </Text>
      <Inline gap="sm" wrap={false} className="shrink-0">
        <FileUpload
          variant="button"
          list={false}
          accept={pictureTypes}
          value={null}
          icon={<ImageUp />}
          loading={logos.uploading}
          disabled={disabled}
          onReject={() => toast.danger(t('unsupported'))}
          onValueChange={file => {
            if (file instanceof File) {
              void logos.upload(file).then(key => {
                if (key !== undefined) {
                  onChange(key)
                }
              })
            }
          }}
        >
          {t(logo === null ? 'pick' : 'replace')}
        </FileUpload>
        {logo !== null && (
          <Button
            variant="outline"
            tone="neutral"
            disabled={disabled || logos.uploading}
            onClick={() => onChange(null)}
          >
            {t('removeLogo')}
          </Button>
        )}
      </Inline>
    </Inline>
  )
}
