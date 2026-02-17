import { INSERT_EMBED_COMMAND } from '@lexical/react/LexicalAutoEmbedPlugin'

import {
  CustomEmbedConfig,
  EmbedConfigs,
} from '@/components/editor/libs/plugins/embeds/auto-embed-plugin'
import { ComponentPickerOption } from '@/components/editor/libs/plugins/picker/component-picker-option'
import { useTranslations } from 'next-intl'

export function EmbedsPickerPlugin({ embed }: { embed: 'tweet' | 'youtube-video' }) {
  const t = useTranslations('Components.Editor.Embeds')
  const embedConfig = EmbedConfigs.find(config => config.type === embed) as CustomEmbedConfig

  return new ComponentPickerOption(t('embedWithName', { name: embedConfig.contentName }), {
    icon: embedConfig.icon,
    keywords: [...embedConfig.keywords, 'embed'],
    onSelect: (_, editor) => editor.dispatchCommand(INSERT_EMBED_COMMAND, embedConfig.type),
  })
}
