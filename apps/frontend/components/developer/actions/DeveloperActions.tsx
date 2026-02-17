'use client'

import { Edit } from './Edit'
import { History } from './History'

interface DeveloperActionsProps {
  developer_id: number
}

export const DeveloperActions = ({ developer_id }: DeveloperActionsProps) => {
  return (
    <div className="flex gap-2 items-center">
      <Edit developer_id={developer_id} />
      <History developer_id={developer_id} />
    </div>
  )
}
