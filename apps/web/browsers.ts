export const supportedBrowsers = {
  chrome: '111',
  edge: '111',
  firefox: '115',
  safari: '16.4',
  safari_ios: '16.4',
}

export const buildTarget = Object.entries(supportedBrowsers).map(
  ([browser, version]) => `${browser === 'safari_ios' ? 'ios' : browser}${version}`,
)
