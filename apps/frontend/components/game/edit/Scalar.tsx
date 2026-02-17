'use client'

import { GameScalar } from '@/interfaces/edit/scalar.interface'
import { Form } from '@/components/shionui/Form'
import { Titles } from './scalar/Titles'
import { Aliases } from './scalar/Aliases'
import { Platform } from './scalar/Platform'
import { Type } from './scalar/Type'
import { Intros } from './scalar/Intros'
import { Tags } from '../actions/Tags'
import { ExtraInfo } from './scalar/ExtraInfo'
import { Staffs } from './scalar/Staffs'
import { ReleaseDate } from './scalar/ReleaseDate'
import { NSFW } from './scalar/NSFW'
import { useForm } from 'react-hook-form'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { Button } from '@/components/shionui/Button'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { shionlibRequest } from '@/utils/request'
import { useParams } from 'next/navigation'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { useRouter } from '@/i18n/navigation.client'
import { pick } from './helper/pick'
import { pickChanges, ChangesResult } from '@/utils/pick-changes'
import { Confirm } from './scalar/Confirm'
import { EditNote } from './EditNote'
import { ReleaseDateTBA } from './scalar/ReleaseDateTBA'

interface ScalarProps {
  data: GameScalar
}

export const Scalar = ({ data }: ScalarProps) => {
  const t = useTranslations('Components.Game.Edit.Scalar')
  const { gamePermissions: permissions } = useEditPermissionStore()
  const [loading, setLoading] = useState(false)
  const { id } = useParams()
  const router = useRouter()
  const form = useForm<GameScalar>({
    defaultValues: data,
  })
  const onSubmit = async (data: GameScalar) => {
    try {
      setLoading(true)
      await shionlibRequest().patch(`/game/${id}/edit/scalar`, {
        data: {
          ...pick(data, permissions!.fields),
          note,
        },
      })
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
      router.push(`/game/${id}`, { scroll: true })
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const [changes, setChanges] = useState<ChangesResult | null>(null)
  const [formValues, setFormValues] = useState<GameScalar>(data)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => {
    const subscription = form.watch(values => {
      setFormValues(values as GameScalar)
    })
    return () => subscription.unsubscribe()
  }, [form])
  useEffect(() => {
    const { field_changes, before, after } = pickChanges(formValues, data)
    setChanges({ field_changes, before, after })
  }, [formValues, data])
  const handleSubmit = () => {
    onSubmit(formValues)
  }
  return (
    <div>
      <Form {...form}>
        <form
          onSubmit={e => {
            e.preventDefault()
            setOpen(true)
          }}
          className="space-y-4"
        >
          {permissions?.scalarFields.includes('TITLES') && <Titles form={form} />}
          {permissions?.scalarFields.includes('PLATFORMS') && <Platform form={form} />}
          {permissions?.scalarFields.includes('TYPE') && <Type form={form} />}
          {permissions?.scalarFields.includes('ALIASES') && <Aliases form={form} />}
          {permissions?.scalarFields.includes('TAGS') && <Tags form={form} />}
          {permissions?.scalarFields.includes('INTROS') && <Intros form={form} />}
          {permissions?.scalarFields.includes('RELEASE') && <ReleaseDate form={form} />}
          {permissions?.scalarFields.includes('RELEASE') && <ReleaseDateTBA form={form} />}
          {permissions?.scalarFields.includes('EXTRA') && <ExtraInfo form={form} />}
          {permissions?.scalarFields.includes('STAFFS') && <Staffs form={form} />}
          {permissions?.scalarFields.includes('NSFW') && <NSFW form={form} />}

          <EditNote onChange={e => setNote(e.target.value)} />
          <Button
            type="submit"
            className="w-full mt-12"
            disabled={!changes?.field_changes.length}
            loading={loading}
            renderIcon={<Check />}
          >
            {t('submit')}
          </Button>
        </form>
      </Form>
      <Confirm open={open} setOpen={setOpen} handleSubmit={handleSubmit} changes={changes} />
    </div>
  )
}
