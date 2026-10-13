import { useTranslations } from 'use-intl'
import { mostTranslators } from './resource-info'
import type { ResourceIssueMessage } from './resource.schema'

export function useResourceIssue(): ResourceIssueMessage {
  const t = useTranslations('resource.issue')
  return issue => t(issue, { max: mostTranslators })
}
