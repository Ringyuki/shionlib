import { getDirectoryTree } from '@/libs/docs/directoryTree'
import { DocsSideBar } from '@/components/docs/sidebar/SideBar'

export default async function DocsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const tree = getDirectoryTree(locale)
  return (
    <div className="w-full min-w-0 my-4 flex">
      <div className="hidden lg:block w-64">
        <DocsSideBar tree={tree} />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
