import * as v from 'valibot'
import { resourceTabs, type ResourceTab } from './resource-page'

const resourceTab = v.picklist(resourceTabs)

export function resourceTabFrom(value: unknown): ResourceTab | undefined {
  const parsed = v.safeParse(resourceTab, value)
  return parsed.success ? parsed.output : undefined
}
