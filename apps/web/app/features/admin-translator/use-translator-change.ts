import { href, useFetcher } from 'react-router'
import { useCommand } from '~/shared/route/use-command'
import type { TranslatorChange } from './admin-translator.schema'
import type { translatorAction } from './admin-translator.server'

export function useTranslatorChange() {
  const command = useCommand(
    useFetcher<typeof translatorAction>(),
    href('/resources/admin/translators'),
  )
  return {
    ...command,
    run: (change: TranslatorChange) => command.run(change),
    confirm: (change: TranslatorChange) => command.confirm(change),
  }
}
