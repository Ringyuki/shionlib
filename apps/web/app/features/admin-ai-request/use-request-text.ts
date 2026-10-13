import { useTranslations } from 'use-intl'
import { protocolName, sceneLabel, useAiFormat, type SceneName } from '~/features/admin-ai'
import { adaptationOf, type Logged } from './admin-ai-request'

export function useRequestText(scenes: readonly SceneName[]) {
  const t = useTranslations('adminAiRequest')
  const shared = useTranslations('adminAi.source')
  const format = useAiFormat()
  return {
    source: (request: Logged) =>
      request.source === 'scene'
        ? (sceneLabel(request, scenes) ?? t('unknownScene'))
        : shared(request.source),
    usage: (request: Logged) =>
      [
        request.input_tokens > 0 && t('usage.input', { count: request.input_tokens }),
        request.output_tokens > 0 && t('usage.output', { count: request.output_tokens }),
      ]
        .filter(part => part !== false)
        .join(t('dot')),
    took: (request: Logged) =>
      request.first_token_ms === null
        ? t('took.total', { total: format.duration(request.duration_ms) })
        : t('took.both', {
            first: format.latency(request.first_token_ms),
            total: format.duration(request.duration_ms),
          }),
    adaptation: (request: Logged) => {
      const adaptation = adaptationOf(request.adaptation)
      switch (adaptation?.kind) {
        case 'protocol':
          return t('adapted.protocol', { protocol: protocolName(adaptation.protocol) })
        case 'drop':
          return t('adapted.drop', { param: adaptation.param })
        case 'json_mode':
          return t('adapted.json_mode')
        default:
          return undefined
      }
    },
  }
}
