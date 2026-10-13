import { Card, Dialog, FormField, Inline, Listbox, Text } from '@hina-ui/react'
import { Folder } from 'lucide-react'
import { useTranslations } from 'use-intl'
import { Button } from '~/shared/ui/button'
import { useOpenState } from '~/shared/ui/use-open-state'
import { dirChoices, folderName, type CompositionDir } from '../resource-composition'

type CompositionFolderProps = {
  label: string
  heading: string
  hint: string
  path: string
  dirs: readonly CompositionDir[] | null
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onPick: (path: string) => Promise<boolean>
}

export function CompositionFolder({
  label,
  heading,
  hint,
  path,
  dirs,
  open,
  pending,
  onOpenChange,
  onPick,
}: CompositionFolderProps) {
  const t = useTranslations('resource.composition')
  const [picked, setPicked] = useOpenState(open, () => path)
  const nameOf = (dir: string) => (dir === '' ? t('root') : folderName(dir))
  return (
    <FormField name={label} label={label}>
      <Card padded={false} className="py-1.5 ps-4 pe-1.5">
        <Inline gap="sm" align="center" wrap={false}>
          <Folder aria-hidden className="size-4 shrink-0 text-muted" />
          <Text className="min-w-0 flex-1 break-all">{nameOf(path)}</Text>
          <Button variant="ghost" tone="neutral" size="sm" onClick={() => onOpenChange(true)}>
            {t('changeDir')}
          </Button>
        </Inline>
      </Card>
      <Dialog
        title={heading}
        description={hint}
        open={open}
        onOpenChange={onOpenChange}
        renderContent={() => (
          <Listbox
            aria-label={heading}
            variant="bare"
            padded={false}
            options={dirChoices(dirs).map(dir => ({
              value: dir.path,
              label: nameOf(dir.path),
              dir,
            }))}
            value={picked}
            onValueChange={value => {
              if (typeof value === 'string') {
                setPicked(value)
              }
            }}
            renderOption={({ option }) => (
              <Inline
                gap="sm"
                align="center"
                wrap={false}
                className="min-w-0"
                style={{ paddingInlineStart: `${option.dir.depth * 1.25}rem` }}
              >
                <Folder aria-hidden className="size-4 shrink-0 text-muted" />
                <Text as="span" truncate>
                  {option.label}
                </Text>
                <Text as="span" size="sm" tone="faint" className="shrink-0 tabular-nums">
                  {t('items', { count: option.dir.items })}
                </Text>
              </Inline>
            )}
          />
        )}
        renderFooter={({ close }) => (
          <>
            <Button variant="ghost" tone="neutral" disabled={pending} onClick={close}>
              {t('cancel')}
            </Button>
            <Button
              loading={pending}
              onClick={() =>
                void onPick(picked).then(done => {
                  if (done) {
                    close()
                  }
                })
              }
            >
              {t('confirm')}
            </Button>
          </>
        )}
      />
    </FormField>
  )
}
