import { DropdownMenu, DropdownMenuItem } from '@hina-ui/react'
import { Ellipsis, ExternalLink, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useTranslations } from 'use-intl'
import { translatorPath } from '~/features/translator'
import { IconButton } from '~/shared/ui/button'
import type { Translator } from '../admin-translator'

type TranslatorMenuProps = {
  translator: Translator
  onEdit: (translator: Translator) => void
}

export function TranslatorMenu({ translator, onEdit }: TranslatorMenuProps) {
  const t = useTranslations('adminTranslator')
  const navigate = useNavigate()
  const label = t('menu.label', { name: translator.name })
  return (
    <DropdownMenu
      label={label}
      align="end"
      content={
        <>
          <DropdownMenuItem
            icon={<ExternalLink />}
            onSelect={() => void navigate(translatorPath('zh', translator.id))}
          >
            {t('menu.view')}
          </DropdownMenuItem>
          <DropdownMenuItem icon={<Pencil />} onSelect={() => onEdit(translator)}>
            {t('menu.edit')}
          </DropdownMenuItem>
        </>
      }
    >
      <IconButton variant="ghost" tone="neutral" size="sm" label={label} tooltip={false}>
        <Ellipsis />
      </IconButton>
    </DropdownMenu>
  )
}
