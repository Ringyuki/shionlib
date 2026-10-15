import { CopyButton, Inline, Text } from '@hina-ui/react'
import { useTranslations } from 'use-intl'
import type { UploadFailure } from '../admin-upload'

type ClientError = UploadFailure['error']

export function useErrorText() {
  const t = useTranslations('adminUpload')
  return (error: ClientError): string => {
    const parts = [
      error.status === null ? undefined : t('errorStatus', { status: error.status }),
      error.code === null ? undefined : t('errorCode', { code: error.code }),
    ].filter(part => part !== undefined)
    if (parts.length > 0) {
      return parts.join('，')
    }
    return error.message === '' ? error.name : `${error.name}: ${error.message}`
  }
}

export function Copyable({ text, label }: { text: string; label: string }) {
  return (
    <Inline gap="xs" align="center" wrap={false} className="min-w-0">
      <Text as="span" size="inherit" className="font-mono break-all">
        {text}
      </Text>
      <CopyButton text={text} label={label} size="sm" />
    </Inline>
  )
}
