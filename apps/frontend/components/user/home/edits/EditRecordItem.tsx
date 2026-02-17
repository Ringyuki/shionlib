import { EditRecordItem as EditRecordItemInterface } from '@/interfaces/user/edits.interface'
import { Card, CardContent } from '@/components/shionui/Card'
import { Link } from '@/i18n/navigation'
import { Badge } from '@/components/shionui/Badge'
import { getTranslations, getLocale } from 'next-intl/server'
import { Edit, Calendar } from 'lucide-react'
import { timeFromNow } from '@/utils/time-format'
import {
  getPreferredContent,
  getPreferredCharacterContent,
} from '@/components/game/description/helpers/getPreferredContent'
import { GameData, GameCharacter } from '@/interfaces/game/game.interface'
import { EditChanges } from './EditChanges'
import { Separator } from '@/components/shionui/Separator'

interface EditRecordItemProps {
  record: EditRecordItemInterface
}

export const EditRecordItem = async ({ record }: EditRecordItemProps) => {
  const t = await getTranslations('Components.User.Home.Edits.EditRecordItem')
  const locale = await getLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  const getEntityTitle = () => {
    if (record.entity === 'game' && record.entity_info) {
      const { title } = getPreferredContent(record.entity_info as GameData, 'title', lang)
      return title
    }
    if (record.entity === 'character' && record.entity_info) {
      const { name } = getPreferredCharacterContent(
        record.entity_info as GameCharacter,
        'name',
        lang,
      )
      return name
    }
    if (record.entity === 'developer' && record.entity_info) {
      return record.entity_info.name || record.entity_info.aliases?.[0] || 'Unknown'
    }
    return 'Unknown'
  }

  const getEntityLink = () => {
    if (record.entity === 'game') return `/game/${record.target_id}`
    if (record.entity === 'character') return `/character/${record.target_id}`
    if (record.entity === 'developer') return `/developer/${record.target_id}`
    return '#'
  }

  const entityTitle = getEntityTitle()
  const entityLink = getEntityLink()

  const getActionDescription = () => {
    const actionText = t(`actionType.${record.action}`)
    if (record.relation_type) {
      const relationType = t(`relationType.${record.relation_type}`)
      return `${actionText} - ${relationType}`
    }
    return actionText
  }

  return (
    <Card className="py-0 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <Edit className="size-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{t('edited')}</span>
                  <Badge variant="secondary">{t(`entity.${record.entity}`)}</Badge>
                  {entityLink ? (
                    <Link
                      href={entityLink}
                      className="hover:opacity-85 transition-all duration-200"
                    >
                      <span className="font-bold">{entityTitle}</span>
                    </Link>
                  ) : (
                    <span className="font-bold">{entityTitle}</span>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{getActionDescription()}</Badge>
                  </div>
                </div>
              </div>
            </div>
            <Badge variant="neutral" className="flex items-center gap-1">
              <Calendar className="size-3" />
              {timeFromNow(record.created, locale)}
            </Badge>
          </div>

          {record.field_changes && record.field_changes.length > 0 && (
            <div className="flex gap-1 items-center">
              <span className="text-sm text-muted-foreground">{t('fieldChanges')}</span>
              <div className="flex flex-wrap gap-2">
                {record.field_changes.map((field, index) => (
                  <Badge key={index} variant="neutral" className="font-mono! text-xs">
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <Separator />
          {record.changes && <EditChanges changes={record.changes} />}
        </div>
      </CardContent>
    </Card>
  )
}
