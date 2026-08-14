import { GameCharacterRole, Prisma } from '@prisma/client'
import {
  OpenCover,
  OpenGalgameCharacter,
  OpenGalgameDetail,
  OpenGalgameStaff,
  OpenMedia,
} from '../interfaces/open-api.interface'

const STAFF_ROLE_CN: Record<string, string> = {
  GAME_DESIGNER: '游戏设计师',
  DIRECTOR: '导演',
  PRODUCER: '制作人',
  SUPERVISOR: '监修',
  EXECUTIVE_PRODUCER: '制作总指挥',
  ORIGINAL_WORK: '原作',
  CHARACTER_DESIGN: '人物设定',
  MECHANICAL_DESIGN: '机械设定',
  LEVEL_DESIGN: '关卡设计',
  PLANNING: '企画',
  PROGRAM: '程序',
  QC: 'QC',
  SCENARIO: '剧本',
  SERIES_COMPOSITION: '系列构成',
  ANIMATION_SUPERVISOR: '作画监督',
  ART: '原画',
  GRAPHICS: '美工',
  CG_SUPERVISOR: 'CG 监修',
  SD_ART: 'SD原画',
  BACKGROUND: '背景',
  COVER_ART: '海报',
  SOUND_DIRECTOR: '音响监督',
  MUSIC: '音乐',
  THEME_COMPOSITION: '主题歌作曲',
  THEME_LYRICS: '主题歌作词',
  THEME_PERFORMANCE: '主题歌演出',
  INSERT_PERFORMANCE: '插入歌演出',
  ANIMATION_PRODUCTION: '动画制作',
  ANIMATION_DIRECTOR: '动画监督',
  ANIMATION_SCRIPT: '动画剧本',
  COOPERATION: '协力',
  TRANSLATOR: '翻译',
  EDITOR: '编辑',
}

const CHARACTER_ROLE_MAP: Record<OpenGalgameCharacter['role'], GameCharacterRole> = {
  MAIN: GameCharacterRole.main,
  PRIMARY: GameCharacterRole.primary,
  SUPPORTING: GameCharacterRole.side,
  GUEST: GameCharacterRole.appears,
}

const DEVELOPER_ROLE_CN: Record<string, string> = {
  DEVELOPER: '开发',
  PUBLISHER: '发行',
  LOCALIZER: '本地化',
}

function isZhOrigin(originLang: string | null): boolean {
  return originLang === 'zh-Hans' || originLang === 'zh-Hant'
}

export function mapCoverLanguage(language: string | null): string {
  if (language === 'ja') return 'jp'
  if (language === 'en') return 'en'
  if (isZhOrigin(language) || language === 'zh') return 'zh'
  return 'unknown'
}

export function mapCoverKind(kind: OpenCover['kind']): string {
  return kind === 'PKGFRONT' ? 'pkgfront' : 'dig'
}

export function mapCharacterRole(role: OpenGalgameCharacter['role']): GameCharacterRole {
  return CHARACTER_ROLE_MAP[role] ?? GameCharacterRole.side
}

export function mapDeveloperRole(role: string | null): string {
  return (role && DEVELOPER_ROLE_CN[role]) || '开发'
}

export function mapStaffs(rows: OpenGalgameStaff[]): { name: string; role: string }[] {
  return rows.map(row => ({
    name: row.person.name,
    role: row.role ? (STAFF_ROLE_CN[row.role] ?? row.role) : '',
  }))
}

export function mapActor(row: OpenGalgameCharacter): string | null {
  if (!row.actors.length) return null
  return row.actors.map(actor => actor.name).join(', ')
}

export function mediaDims(media: OpenMedia): number[] {
  return media.width !== null && media.height !== null ? [media.width, media.height] : []
}

export function mapGalgameScalars(detail: OpenGalgameDetail): Prisma.GameUpdateInput {
  const zhOrigin = isZhOrigin(detail.origin_lang)
  const enOrigin = detail.origin_lang === 'en'
  const jaOrigin = !zhOrigin && !enOrigin

  return {
    title_jp: jaOrigin ? detail.origin_title : '',
    title_zh: detail.trans_title ?? (zhOrigin ? detail.origin_title : ''),
    title_en: detail.en_title ?? (enOrigin ? detail.origin_title : ''),
    aliases: detail.aliases,
    intro_jp: jaOrigin ? (detail.origin_intro ?? '') : '',
    intro_zh: detail.trans_intro ?? (zhOrigin ? (detail.origin_intro ?? '') : ''),
    intro_en: detail.en_intro ?? (enOrigin ? (detail.origin_intro ?? '') : ''),
    release_date: detail.release_date ? new Date(detail.release_date) : null,
    release_date_tba: detail.release_date_tbd,
    type: detail.adv_type,
    platform: detail.platforms,
    nsfw: detail.nsfw,
  }
}
