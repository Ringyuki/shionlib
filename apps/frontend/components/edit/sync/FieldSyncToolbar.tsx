import { useTranslations } from 'next-intl'
import { RefreshCw, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/shionui/Button'
import { Input } from '@/components/shionui/Input'

interface FieldSyncToolbarProps {
  query: string
  onQueryChange: (query: string) => void
  onSelectRecommended: () => void
  onClearSelection: () => void
}

export const FieldSyncToolbar = ({
  query,
  onQueryChange,
  onSelectRecommended,
  onClearSelection,
}: FieldSyncToolbarProps) => {
  const t = useTranslations('Components.Common.Edit.FieldSync')

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        type="button"
        intent="secondary"
        appearance="outline"
        onClick={onSelectRecommended}
        renderIcon={<RefreshCw className="size-4" />}
      >
        {t('selectRecommended')}
      </Button>
      <Input
        prefix={<Search className="size-4" />}
        value={query}
        onChange={event => onQueryChange(event.target.value)}
        placeholder={t('search')}
      />
      <Button
        type="button"
        intent="secondary"
        appearance="ghost"
        onClick={onClearSelection}
        renderIcon={<RotateCcw className="size-4" />}
      >
        {t('clear')}
      </Button>
    </div>
  )
}
