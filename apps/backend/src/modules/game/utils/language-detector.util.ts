const resultMap = new Map<string, string>()

export const detectLanguage = async (input: string): Promise<'jp' | 'zh' | 'en' | 'unknown'> => {
  if (!input) return 'unknown'
  if (resultMap.has(input)) return formatLanguageCode(resultMap.get(input)!)
  const { franc } = await import('franc')
  const languageCode = franc(input)
  resultMap.set(input, languageCode)
  return formatLanguageCode(languageCode)
}

const formatLanguageCode = (languageCode: string) => {
  switch (languageCode) {
    case 'jpn':
      return 'jp'
    case 'zho':
    case 'cmn':
      return 'zh'
    case 'eng':
      return 'en'
    default:
      return 'unknown'
  }
}
