import { Button } from '@/components/shionui/Button'
import { useTranslations } from 'next-intl'
import { Shapes } from 'lucide-react'
import { useState } from 'react'
import { MoyuPatchResource } from '@/interfaces/patch/patch.interface'
import { shionlibRequest } from '@/utils/request'
import { ShionlibBizError } from '@/libs/errors'
import { sileo } from 'sileo'
import { Patch as PatchComponent } from '../patch/Patch'

interface PatchProps {
  game_id: number
}

export const Patch = ({ game_id }: PatchProps) => {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [patches, setPatches] = useState<MoyuPatchResource[]>([])
  const t = useTranslations('Components.Game.Actions.Patch')

  const getData = async () => {
    try {
      setLoading(true)
      const { data } = await shionlibRequest().get<MoyuPatchResource[]>(
        `/moyu/game/${game_id}/patches`,
      )
      setPatches(data ?? [])
      setOpen(true)
    } catch (error) {
      if (!(error instanceof ShionlibBizError)) sileo.error({ title: t('error') })
    } finally {
      setLoading(false)
    }
  }
  return (
    <>
      <Button appearance="outline" renderIcon={<Shapes />} onClick={getData} loading={loading}>
        {t('patch')}
      </Button>
      <PatchComponent patches={patches} open={open} onOpenChange={setOpen} />
    </>
  )
}
