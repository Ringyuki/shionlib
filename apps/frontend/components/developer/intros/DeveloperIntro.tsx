import { Developer } from '@/interfaces/developer/developer.interface'
import { Card, CardContent } from '@/components/shionui/Card'
import { BasicInfos } from './BasicInfos'
import { Details } from './Details'
import { DeveloperActions } from '../actions/DeveloperActions'

interface DeveloperIntroProps {
  developer: Developer
  works_count: number
}
export const DeveloperIntro = ({ developer, works_count }: DeveloperIntroProps) => {
  return (
    <Card className="py-0">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <BasicInfos developer={developer} works_count={works_count} />
          <Details developer={developer} />
          <DeveloperActions developer_id={developer.id} />
        </div>
      </CardContent>
    </Card>
  )
}
