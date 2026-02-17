import { redirect } from 'next/navigation'

interface UserPageProps {
  params: Promise<{ id: string }>
}

export default async function UserPage({ params }: UserPageProps) {
  const { id } = await params
  redirect(`/user/${id}/uploads`)
}
