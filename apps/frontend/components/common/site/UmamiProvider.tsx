import Script from 'next/script'

export const UmamiProvider = () => {
  if (process.env.NODE_ENV !== 'production') return null

  const umami_script_url = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL
  const umami_website_id = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
  if (!umami_script_url || !umami_website_id) return null

  return <Script defer src={umami_script_url} data-website-id={umami_website_id} />
}
