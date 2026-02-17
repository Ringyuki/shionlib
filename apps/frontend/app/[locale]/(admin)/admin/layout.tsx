import { shionlibRequest } from '@/utils/request'
import { User } from '@/interfaces/user/user.interface'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/shionui/Sidebar'

interface AdminLayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

async function getUser() {
  const res = await shionlibRequest({ forceNotThrowError: true }).get<User>('/user/me')
  return res.data
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { locale } = await params
  const user = await getUser()

  if (!user || user.role < 2) {
    redirect(`/${locale}`)
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset className="flex flex-col bg-gray-50 dark:bg-gray-950">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 bg-white/50 px-4 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-900/50">
          <SidebarTrigger />
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
