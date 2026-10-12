import { href, useFetcher } from 'react-router'
import { parseOptional } from '~/shared/form/check'
import { useCommand } from '~/shared/route/use-command'
import { providerCommand, type ProviderChange } from './admin-ai-provider.schema'
import type { aiProviderAction } from './admin-ai-provider.server'

export function useProviderChange(options: { revalidate?: boolean } = {}) {
  const command = useCommand(
    useFetcher<typeof aiProviderAction>(),
    href('/resources/admin/ai/providers'),
    options,
  )
  return {
    ...command,
    submitted: parseOptional(providerCommand, command.payload),
    run: (change: ProviderChange) => command.run(change),
    confirm: (change: ProviderChange) => command.confirm(change),
  }
}
