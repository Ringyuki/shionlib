import { EditRecordItem as EditRecordItemInterface } from '@/interfaces/user/edits.interface'
import { EditRecordItem } from './EditRecordItem'

interface EditsContentProps {
  edits: EditRecordItemInterface[]
}

export const EditsContent = ({ edits }: EditsContentProps) => {
  return (
    <div className="flex flex-col gap-6">
      {edits.map(edit => (
        <EditRecordItem key={edit.id} record={edit} />
      ))}
    </div>
  )
}
