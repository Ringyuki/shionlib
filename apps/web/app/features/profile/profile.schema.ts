import * as v from 'valibot'
import { profileTabs, type ProfileTab } from './profile'

const profileTab = v.picklist(profileTabs)

export function profileTabFrom(value: unknown): ProfileTab | undefined {
  const parsed = v.safeParse(profileTab, value)
  return parsed.success ? parsed.output : undefined
}
