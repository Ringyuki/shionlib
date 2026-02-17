import { CommandDialog } from '@/components/shionui/Command'
import { SearchCommand } from './command/SearchCommand'
import { useSearchStore } from '@/store/searchStore'

export const SearchDialog = () => {
  const { searchDialogOpen, closeSearchDialog } = useSearchStore()

  return (
    <CommandDialog
      open={searchDialogOpen}
      onOpenChange={open => {
        if (!open) closeSearchDialog()
      }}
      showCloseButton={false}
      className="rounded-xl p-0"
    >
      <SearchCommand />
    </CommandDialog>
  )
}
