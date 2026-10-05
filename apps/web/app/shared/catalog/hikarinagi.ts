export type CatalogEntity = 'galgame' | 'producer' | 'character'

const entryPaths: Record<CatalogEntity, string> = {
  galgame: 'galgames',
  producer: 'producers',
  character: 'characters',
}

export function hikarinagiEntryUrl(site: string, entity: CatalogEntity, id: number): string {
  return `${site}/${entryPaths[entity]}/${id}`
}

export function hikarinagiEditUrl(site: string, entity: CatalogEntity, id: number): string {
  return `${site}/create/edit/${entity}/${id}`
}
