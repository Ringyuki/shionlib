import { GameCharacter, GameCharacterGenderMap } from '@/interfaces/game/game.interface'
import { getTranslations, getLocale } from 'next-intl/server'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { User } from 'lucide-react'
import { Badge } from '@/components/shionui/Badge'
import { getPreferredCharacterContent } from '@/components/game/description/helpers/getPreferredContent'

interface BasicInfosProps {
  character: GameCharacter
  appearances_count: number
}

export const BasicInfos = async ({ character, appearances_count }: BasicInfosProps) => {
  const t = await getTranslations('Components.Character.Intros.BasicInfos')
  const locale = await getLocale()
  const langMap = { en: 'en', ja: 'jp', zh: 'zh' } as const
  const lang = langMap[locale as keyof typeof langMap] ?? 'jp'
  const { name } = getPreferredCharacterContent(character, 'name', lang)

  return (
    <div className="flex flex-col md:flex-row items-center gap-4">
      {character.image ? (
        <FadeImage
          src={character.image}
          alt={name}
          height={300}
          width={225}
          fill={false}
          aspectRatio="3 / 4"
          className="rounded-md w-40 bg-muted"
          imageClassName="object-contain h-full w-full"
        />
      ) : (
        <div
          className="rounded-md w-40 bg-muted flex items-center justify-center"
          style={{ aspectRatio: '3 / 4' }}
        >
          <User className="size-10" />
        </div>
      )}
      <div className="flex flex-col flex-1 gap-2 items-center md:items-start">
        <div className="flex flex-col md:flex-row justify-between items-center w-full">
          <h2 className="text-2xl font-normal flex items-center gap-2 flex-wrap justify-center">
            {name}
            <Badge variant="secondary">
              {t('appearances_count', { count: appearances_count })}
            </Badge>
            {character.gender && character.gender.length > 0 && (
              <Badge variant="secondary">{t(GameCharacterGenderMap[character.gender[0]])}</Badge>
            )}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
          {character.aliases &&
            character.aliases.length > 0 &&
            character.aliases.map(alias => (
              <span key={alias} className="font-light">
                {alias}
              </span>
            ))}
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          {character.age && (
            <span>
              {t('age')}: {character.age}
            </span>
          )}
          {character.birthday && character.birthday.length === 2 && character.birthday[0] > 0 && (
            <span>
              {t('birthday')}: {character.birthday[0]}/{character.birthday[1]}
            </span>
          )}
          {character.blood_type && (
            <span>
              {t('blood_type')}: {character.blood_type.toUpperCase()}
            </span>
          )}
        </div>
        {(character.height || character.weight) && (
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {character.height && (
              <span>
                {t('height')}: {character.height}cm
              </span>
            )}
            {character.weight && (
              <span>
                {t('weight')}: {character.weight}kg
              </span>
            )}
          </div>
        )}
        {(character.bust || character.waist || character.hips) && (
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>
              B{character.bust || '?'} / W{character.waist || '?'} / H{character.hips || '?'}
              {character.cup && ` (${character.cup})`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
