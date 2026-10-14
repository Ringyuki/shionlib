import type { Locale } from '@/config'
import { formatNumber } from './format'

export type Labels = {
  platform: Record<string, string>
  language: Record<string, string>
  form: Record<string, string>
  role: Record<string, string>
  gender: Record<string, string>
  walkthroughLanguage: Record<string, string>
  docsCategory: Record<string, string>
  docs: string
  slogan: readonly string[]
  walkthrough: string
  sponsor: string
  admin: string
  uploads: string
  comments: string
  walkthroughs: string
  resources: (count: number) => string
  downloads: (count: number) => string
  works: (count: number) => string
  moreRoutes: (count: number) => string
  voice: (name: string) => string
  age: (age: number) => string
  updated: (date: string) => string
}

const platform = {
  win: 'Windows',
  mac: 'macOS',
  ios: 'iOS',
  and: 'Android',
  lin: 'Linux',
  ps3: 'PS3',
  ps4: 'PS4',
  psv: 'PS Vita',
  psp: 'PSP',
  swi: 'Switch',
  dvd: 'DVD',
}

const english = (count: number, one: string, other: string) =>
  `${formatNumber('en', count)} ${count === 1 ? one : other}`

const labels: Record<Locale, Labels> = {
  zh: {
    platform,
    language: { zh: '简中', 'zh-hant': '繁中', jp: '日文', en: '英文' },
    form: { portable: '免安装', installer: '安装程序', disc: '光盘映像' },
    role: { main: '主角', primary: '主要角色', side: '配角', appears: '登场' },
    gender: { m: '男', f: '女', o: '其他', a: '无性别' },
    walkthroughLanguage: { zh: '中文', 'zh-hant': '繁体中文', jp: '日语', en: '英语' },
    docsCategory: { guides: '指南', about: '关于', dev: '开发' },
    docs: '文档',
    slogan: ['免费、开源、零门槛的', '视觉小说/Galgame 档案库'],
    walkthrough: '攻略',
    sponsor: '赞助者',
    admin: '管理员',
    uploads: '上传',
    comments: '评论',
    walkthroughs: '攻略',
    resources: count => `${count} 个资源`,
    downloads: count => `${formatNumber('zh', count)} 次下载`,
    works: count => `${formatNumber('zh', count)} 部作品`,
    moreRoutes: count => `等 ${formatNumber('zh', count)} 条线路`,
    voice: name => `CV ${name}`,
    age: age => `${formatNumber('zh', age)} 岁`,
    updated: date => `更新于 ${date}`,
  },
  en: {
    platform,
    language: {
      zh: 'Simplified Chinese',
      'zh-hant': 'Traditional Chinese',
      jp: 'Japanese',
      en: 'English',
    },
    form: { portable: 'Portable', installer: 'Installer', disc: 'Disc image' },
    role: {
      main: 'Protagonist',
      primary: 'Main characters',
      side: 'Side characters',
      appears: 'Appearances',
    },
    gender: { m: 'Male', f: 'Female', o: 'Other', a: 'None' },
    walkthroughLanguage: {
      zh: 'Chinese',
      'zh-hant': 'Traditional Chinese',
      jp: 'Japanese',
      en: 'English',
    },
    docsCategory: { guides: 'Guides', about: 'About', dev: 'Development' },
    docs: 'Docs',
    slogan: ['Free, open-source, zero-threshold', 'visual novel/Galgame archive'],
    walkthrough: 'Walkthrough',
    sponsor: 'Sponsor',
    admin: 'Admin',
    uploads: 'Uploads',
    comments: 'Comments',
    walkthroughs: 'Walkthroughs',
    resources: count => english(count, 'resource', 'resources'),
    downloads: count => english(count, 'download', 'downloads'),
    works: count => english(count, 'work', 'works'),
    moreRoutes: count => `${english(count, 'route', 'routes')} in all`,
    voice: name => `CV ${name}`,
    age: age => `Age ${formatNumber('en', age)}`,
    updated: date => `Updated ${date}`,
  },
  ja: {
    platform,
    language: { zh: '簡体字', 'zh-hant': '繁体字', jp: '日本語', en: '英語' },
    form: { portable: 'インストール不要', installer: 'インストーラー', disc: 'ディスクイメージ' },
    role: {
      main: '主人公',
      primary: 'メインキャラクター',
      side: 'サブキャラクター',
      appears: '登場',
    },
    gender: { m: '男性', f: '女性', o: 'その他', a: 'なし' },
    walkthroughLanguage: { zh: '中国語', 'zh-hant': '繁体字中国語', jp: '日本語', en: '英語' },
    docsCategory: { guides: 'ガイド', about: 'このサイトについて', dev: '開発' },
    docs: 'ドキュメント',
    slogan: ['無料・オープンソース・気軽に使える', 'ビジュアルノベル／ギャルゲー アーカイブ'],
    walkthrough: '攻略',
    sponsor: 'スポンサー',
    admin: '管理者',
    uploads: 'アップロード',
    comments: 'コメント',
    walkthroughs: '攻略',
    resources: count => `リソース ${formatNumber('ja', count)} 件`,
    downloads: count => `${formatNumber('ja', count)} 回ダウンロード`,
    works: count => `${formatNumber('ja', count)} 作品`,
    moreRoutes: count => `など全 ${formatNumber('ja', count)} ルート`,
    voice: name => `CV ${name}`,
    age: age => `${formatNumber('ja', age)}歳`,
    updated: date => `${date}更新`,
  },
}

export function labelsOf(locale: Locale): Labels {
  return labels[locale]
}
