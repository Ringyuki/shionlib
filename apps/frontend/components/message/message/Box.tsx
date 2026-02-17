import { Switch } from './Switch'

interface BoxProps {
  children: React.ReactNode
}

export const Box = ({ children }: BoxProps) => {
  return (
    <div className="w-full flex flex-col gap-4">
      <Switch />
      {children}
    </div>
  )
}
