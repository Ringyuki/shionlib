import { notFound } from 'next/navigation'
import { CreateGame } from '@/components/create/Create'
import { hikarinagiMirror } from '@/config/site/hikarinagi'

export default function CreateGamePage() {
  if (hikarinagiMirror.enabled) notFound()

  return (
    <div className="container mx-auto my-4">
      <CreateGame />
    </div>
  )
}
