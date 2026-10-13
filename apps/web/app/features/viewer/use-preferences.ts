import { href, useFetcher } from 'react-router'
import { parseOptional } from '~/shared/form/check'
import { useCommand } from '~/shared/route/use-command'
import { preferenceCommand, type PreferenceChange } from './viewer.schema'
import type { preferencesAction } from './viewer.server'

export function usePreferences() {
  const command = useCommand(
    useFetcher<typeof preferencesAction>(),
    href('/resources/viewer/preferences'),
  )
  return {
    save: (change: PreferenceChange) => command.run(change),
    saving: parseOptional(preferenceCommand, command.payload),
    pending: command.pending,
  }
}
