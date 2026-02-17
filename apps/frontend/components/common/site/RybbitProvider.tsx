import Script from 'next/script'

export const RybbitProvider = () => {
  if (process.env.NODE_ENV !== 'production') return null

  const rybbit_script_url = process.env.NEXT_PUBLIC_RYBBIT_SCRIPT_URL
  const rybbit_site_id = process.env.NEXT_PUBLIC_RYBBIT_SITE_ID
  if (!rybbit_script_url || !rybbit_site_id) return null

  return (
    <Script
      defer
      src={rybbit_script_url}
      data-site-id={rybbit_site_id}
      strategy="afterInteractive"
    />
  )
}
