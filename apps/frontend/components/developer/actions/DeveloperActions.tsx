'use client'

import { Edit } from './Edit'
import { History } from './History'

interface DeveloperActionsProps {
  developer_id: number
  developer_h_id?: number
}

export const DeveloperActions = ({ developer_id, developer_h_id }: DeveloperActionsProps) => {
  return (
    <div className="flex gap-2 items-center">
      <Edit developer_id={developer_id} developer_h_id={developer_h_id} />
      <History developer_id={developer_id} />
    </div>
  )
}
