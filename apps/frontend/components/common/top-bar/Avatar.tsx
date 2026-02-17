import { Avatar } from '@/components/common/user/Avatar'
import { User } from '@/interfaces/user/user.interface'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/shionui/DropdownMenu'
import { Logout } from '@/components/common/top-bar/Logout'
import { Settings } from '@/components/common/top-bar/Settings'
import { Profile } from '@/components/common/top-bar/Profile'
import { Admin } from '@/components/common/top-bar/Admin'

interface AvatarProps {
  user: User
  className?: string
}

export const TopBarAvatar = ({ user, className }: AvatarProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className={className}>
        <Avatar clickable={false} user={user} />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" side="bottom" align="end">
        <DropdownMenuLabel>
          <div className="flex items-center gap-2">
            <Avatar clickable={false} user={user} />
            <span>{user.name}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Admin />
        <Profile />
        <Settings />
        <Logout />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
