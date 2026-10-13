import { href, useFetcher } from 'react-router'
import { parseOptional } from '~/shared/form/check'
import { useCommand } from '~/shared/route/use-command'
import { catalogCommand, type CatalogChange } from './admin-catalog.schema'
import type { catalogAction } from './admin-catalog.server'

export function useCatalogChange() {
  const command = useCommand(useFetcher<typeof catalogAction>(), href('/resources/admin/catalog'))
  return {
    ...command,
    submitted: parseOptional(catalogCommand, command.payload),
    run: (change: CatalogChange) => command.run(change),
  }
}
