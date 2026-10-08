import { Dialog, FileUpload, IconButton, Stack, Text } from '@hina-ui/react'
import { Play } from 'lucide-react'
import { useState } from 'react'
import { useFormatter, useTranslations } from 'use-intl'
import { useUploads } from '~/features/upload'
import { Button } from '~/shared/ui/button'
import { useAttachFiles } from '../use-attach-files'

export function Reselect({ compact = false, onOpen }: { compact?: boolean; onOpen: () => void }) {
  const t = useTranslations('uploader.transfers')
  return compact ? (
    <IconButton label={t('resume')} size="sm" onClick={onOpen}>
      <Play />
    </IconButton>
  ) : (
    <Button size="sm" variant="soft" onClick={onOpen}>
      {t('chooseAgain')}
    </Button>
  )
}

type ReselectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReselectDialog({ open, onOpenChange }: ReselectDialogProps) {
  const t = useTranslations('uploader.transfers')
  return (
    <Dialog
      title={t('chooseAgain')}
      open={open}
      onOpenChange={onOpenChange}
      renderContent={({ close }) => <ReselectFiles onDone={close} />}
    />
  )
}

function ReselectFiles({ onDone }: { onDone: () => void }) {
  const t = useTranslations('uploader.transfers')
  const format = useFormatter()
  const attach = useAttachFiles()
  const { uploads } = useUploads()
  const [names] = useState(() =>
    uploads.filter(upload => upload.phase.name === 'needsFile').map(upload => upload.file.name),
  )
  return (
    <Stack gap="md">
      <Text size="sm" tone="muted">
        {t('chooseAgainHint', { names: format.list(names) })}
      </Text>
      <FileUpload
        multiple
        list={false}
        value={[]}
        onValueChange={value => {
          attach(value)
          onDone()
        }}
      >
        {t('chooseAgainDrop')}
      </FileUpload>
    </Stack>
  )
}
