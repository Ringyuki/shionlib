import { Message } from '@/components/message/Message'

export default async function MessageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto my-4">
      <Message>{children}</Message>
    </div>
  )
}
