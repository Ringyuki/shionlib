import { cn, Inline, SegmentedControl, Stack, Text } from '@hina-ui/react'
import { useState } from 'react'
import { useLocale, useTranslations } from 'use-intl'
import { useWalkthroughWriting } from '../use-walkthrough-writing'
import { facesOf, portraitsIn } from '../walkthrough'
import { routesOf, savesOf } from '../walkthrough-draft'
import { routeLimits } from '../walkthrough.schema'
import type { Writing } from '../walkthrough.use-cases'
import { NoteField } from './note-field'
import { RouteForm } from './route-form'
import { LeaveDialog, RemoveDialog } from './writing-dialogs'
import { RouteSheet } from './route-sheet'
import { SaveButtons, WritingHeader } from './writing-header'
import { WritingParts } from './writing-parts'

export function WritingDesk({ writing }: { writing: Writing }) {
  const t = useTranslations('walkthrough')
  const locale = useLocale()
  const faces = facesOf(writing.credits, locale)
  const writer = useWalkthroughWriting(writing, faces)
  const [removing, setRemoving] = useState(false)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const { draft, shown, flagged } = writer
  const index = draft.routes.findIndex(route => route.key === shown)
  const route = draft.routes[index]
  const parts = (roomy: boolean, onPicked?: () => void) => (
    <WritingParts
      routes={draft.routes}
      faces={faces}
      shown={shown}
      full={draft.routes.length >= routeLimits.routes}
      roomy={roomy}
      onShow={key => {
        writer.show(key)
        onPicked?.()
      }}
      onMove={writer.move}
      onAdd={() => {
        writer.add()
        onPicked?.()
      }}
    />
  )
  const saving = {
    state: writer.state,
    saving: writer.saving,
    onSaveDraft: () => void writer.saveDraft(),
    onPublish: () => void writer.publish(),
  }
  return (
    <Stack gap="lg" className="flex-1">
      <WritingHeader
        game={writing.game}
        stored={writer.walkthroughId !== undefined}
        onRemove={() => setRemoving(true)}
        {...saving}
      />
      <NoteField
        value={draft.note}
        error={flagged?.key === undefined ? flagged?.note : undefined}
        onValueChange={writer.writeNote}
      />
      <Stack gap="none" className="gap-1.5">
        <Text as="span" aria-hidden size="sm" weight="medium">
          {t('routes')}
        </Text>
        <Stack gap="none" className="gap-4 lg:flex-row lg:gap-8">
          {route !== undefined && (
            <RouteSheet
              name={route.name.trim()}
              portraits={portraitsIn(route, faces)}
              ordinal={index + 1}
              count={draft.routes.length}
              className="lg:hidden"
              renderRoutes={close => parts(true, close)}
            />
          )}
          <Stack gap="none" className={cn('w-70 shrink-0', route !== undefined && 'max-lg:hidden')}>
            {parts(false)}
          </Stack>
          {route !== undefined && (
            <Stack gap="none" className="min-w-0 flex-1 gap-4">
              <SegmentedControl
                block
                aria-label={t('view')}
                value={view}
                options={[
                  { value: 'edit', label: t('edit') },
                  { value: 'preview', label: t('preview') },
                ]}
                onValueChange={chosen => setView(chosen === 'preview' ? 'preview' : 'edit')}
                className="md:hidden"
              />
              <RouteForm
                key={route.key}
                route={route}
                others={draft.routes.filter(other => other.key !== route.key)}
                written={routesOf(draft)}
                index={index}
                naming={writer.naming}
                words={writer.words}
                saves={savesOf(draft)}
                flagged={flagged}
                previewing={view === 'preview'}
                onChange={change => writer.change(route.key, change)}
                onRemove={() => writer.remove(route.key)}
              />
            </Stack>
          )}
        </Stack>
      </Stack>
      <Inline className="bg-canvas border-line sticky bottom-0 z-10 -mx-4 mt-auto border-t px-4 py-3 sm:-mx-6 sm:px-6 md:hidden">
        <SaveButtons block className="w-full" {...saving} />
      </Inline>
      <LeaveDialog guard={writer.guard} />
      <RemoveDialog
        walkthroughId={writer.walkthroughId}
        open={removing}
        onOpenChange={setRemoving}
        onRemoved={writer.leaveAfterRemoval}
      />
    </Stack>
  )
}
