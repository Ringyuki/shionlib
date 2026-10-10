import { groupOrder, type EditorPlugin, type PluginId, type SlashCommand } from './plugin'
import { blockquote, bulletList, heading, horizontalRule, orderedList } from './plugins/blocks'
import { image, link, table } from './plugins/inserts'
import { bold, italic, spoiler, strike } from './plugins/marks'

export type Profile = 'comment' | 'article'

const registry: Readonly<Record<PluginId, EditorPlugin>> = {
  bold,
  italic,
  strike,
  spoiler,
  heading,
  bulletList,
  orderedList,
  blockquote,
  horizontalRule,
  link,
  image,
  table,
}

type ProfileSpec = { plugins: readonly PluginId[]; slash: boolean; blocks: boolean }

const profiles: Readonly<Record<Profile, ProfileSpec>> = {
  comment: { plugins: ['bold', 'spoiler', 'link'], slash: false, blocks: false },
  article: {
    plugins: [
      'bold',
      'italic',
      'strike',
      'spoiler',
      'heading',
      'bulletList',
      'orderedList',
      'blockquote',
      'horizontalRule',
      'link',
      'image',
      'table',
    ],
    slash: true,
    blocks: true,
  },
}

function byPlace(left: EditorPlugin, right: EditorPlugin): number {
  const groups = groupOrder.indexOf(left.group) - groupOrder.indexOf(right.group)
  return groups === 0 ? left.order - right.order : groups
}

export function pluginsOf(profile: Profile): EditorPlugin[] {
  return profiles[profile].plugins.map(id => registry[id]).sort(byPlace)
}

export function commandsOf(profile: Profile): SlashCommand[] {
  return profiles[profile].slash ? pluginsOf(profile).flatMap(plugin => plugin.commands ?? []) : []
}

export function movesBlocks(profile: Profile): boolean {
  return profiles[profile].blocks
}

export function matchingCommands(commands: readonly SlashCommand[], query: string): SlashCommand[] {
  const wanted = query.trim().toLowerCase()
  if (wanted === '') {
    return [...commands]
  }
  return commands.filter(
    command =>
      command.id.toLowerCase().includes(wanted) ||
      command.keywords.some(keyword => keyword.toLowerCase().includes(wanted)),
  )
}
