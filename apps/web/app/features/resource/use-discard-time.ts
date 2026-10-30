import { useFormatter } from 'use-intl'
import type { Composition } from './resource-composition'

export function useDiscardTime(): (composition: Pick<Composition, 'discard_at'>) => string {
  const format = useFormatter()
  return composition =>
    composition.discard_at === null
      ? ''
      : format.dateTime(new Date(composition.discard_at), {
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
}
