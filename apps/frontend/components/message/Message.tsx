import { Sidebar } from './sidebar/Sidebar'
import { Box } from './message/Box'

interface MessageProps {
  children: React.ReactNode
}

export const Message = ({ children }: MessageProps) => {
  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-6">
      <Sidebar />
      <Box>{children}</Box>
    </div>
  )
}
