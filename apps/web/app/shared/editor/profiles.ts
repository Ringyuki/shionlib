import type { EditorPlugin, PluginId } from './plugin'
import { link } from './plugins/link'
import { bold, spoiler } from './plugins/marks'

export type Profile = 'comment'

const registry: Readonly<Record<PluginId, EditorPlugin>> = { bold, spoiler, link }

const profiles: Readonly<Record<Profile, readonly PluginId[]>> = {
  comment: ['bold', 'spoiler', 'link'],
}

export function pluginsOf(profile: Profile): EditorPlugin[] {
  return profiles[profile].map(id => registry[id])
}
