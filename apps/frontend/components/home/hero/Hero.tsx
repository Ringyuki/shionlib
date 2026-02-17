import { Overview } from './Overview'
import { Shionlib } from './Shionlib'

export const Hero = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Shionlib />
      <Overview />
    </div>
  )
}
