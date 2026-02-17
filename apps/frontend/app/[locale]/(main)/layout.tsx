import ShionlibTopBar from '@/components/common/top-bar/TopBar'
import { GlobalDialogs } from '@/components/common/user/GlobalDialogs'
import { ShionlibFooter } from '@/components/common/footer/Footer'

interface MainLayoutProps {
  children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-radial">
      <ShionlibTopBar />
      <div
        data-vaul-drawer-wrapper
        className="flex min-h-[calc(100dvh-24rem)] w-full max-w-7xl grow px-3 pt-16 topbar:pt-20"
      >
        {children}
      </div>
      <ShionlibFooter />
      <GlobalDialogs />
    </div>
  )
}
