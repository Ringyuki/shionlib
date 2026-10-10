import { Button, Center, cn, Inline, Progress, Stack, Text } from '@hina-ui/react'
import { shownWidth } from '../picture-size'

export type UploadingLabels = {
  uploading: (percent: number) => string
  failed: string
  retry: string
  drop: string
}

export type UploadingPicture = {
  width: number
  height: number
  labels: UploadingLabels
  percent?: number
  failure?: string
  onRetry?: () => void
  onDrop?: () => void
}

const unknownRatio = 16 / 9

export function PictureUploading({
  width,
  height,
  labels,
  percent = 0,
  failure,
  onRetry,
  onDrop,
}: UploadingPicture) {
  const measured = width > 0 && height > 0
  const failed = failure !== undefined
  return (
    <Center
      as="figure"
      role={failed ? 'alert' : 'status'}
      aria-label={failed ? labels.failed : labels.uploading(percent)}
      contentEditable={false}
      className={cn(
        'mx-auto my-4 min-h-28 max-w-full min-w-[min(100%,15rem)] rounded-lg p-4',
        failed ? 'bg-danger-soft' : 'bg-inset',
      )}
      style={{
        width: shownWidth(100, width),
        aspectRatio: measured ? width / height : unknownRatio,
      }}
    >
      {failed ? (
        <Stack gap="sm" align="center">
          <Text as="span" size="sm" tone="danger" className="text-center break-words">
            {failure === '' ? labels.failed : `${labels.failed}：${failure}`}
          </Text>
          <Inline gap="sm" wrap={false}>
            <Button size="sm" variant="outline" tone="neutral" onClick={onRetry}>
              {labels.retry}
            </Button>
            <Button size="sm" variant="ghost" tone="danger" onClick={onDrop}>
              {labels.drop}
            </Button>
          </Inline>
        </Stack>
      ) : (
        <Stack gap="sm" align="center">
          <Text as="span" size="sm" tone="muted" className="tabular-nums">
            {labels.uploading(percent)}
          </Text>
          <Progress value={percent} size="sm" aria-hidden className="w-40" />
        </Stack>
      )}
    </Center>
  )
}
