import { OpenPanelComponent } from '@openpanel/nextjs'

export const OpenPanelProvider = () => {
  if (process.env.NODE_ENV !== 'production') return null

  const clientId = process.env.NEXT_PUBLIC_OPENPANEL_CLIENT_ID
  const apiUrl = process.env.NEXT_PUBLIC_OPENPANEL_API_URL
  if (!clientId || !apiUrl) return null

  return (
    <OpenPanelComponent
      clientId={clientId}
      apiUrl={apiUrl}
      trackScreenViews={true}
      trackAttributes={true}
      trackOutgoingLinks={true}
    />
  )
}
