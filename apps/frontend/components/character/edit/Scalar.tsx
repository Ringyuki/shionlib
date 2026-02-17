'use client'

import type { CharacterScalar } from '@/interfaces/character/character-scalar.interface'
import { Form } from '@/components/shionui/Form'
import { Names } from './scalar/Names'
import { Aliases } from './scalar/Aliases'
import { Intros } from './scalar/Intros'
import { Image as CharacterImage } from './scalar/Image'
import { BodyMetrics } from './scalar/BodyMetrics'
import { AgeBirthday } from './scalar/AgeBirthday'
import { Gender } from './scalar/Gender'
import { BloodType } from './scalar/BloodType'
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
import { pickChanges, ChangesResult } from '@/utils/pick-changes'
import { Confirm } from './scalar/Confirm'
import { EditNote } from './EditNote'
import { redirect } from 'next/navigation'
import { pick } from './helper/pick'

interface ScalarProps {
  data: CharacterScalar
}

export const CharacterScalarEdit = ({ data }: ScalarProps) => {
  const t = useTranslations('Components.Character.Edit.Scalar')
  const { characterPermissions: permissions } = useEditPermissionStore()
  const { id } = useParams()
  if (!permissions) {
    redirect(`/character/${id}`)
  }

  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const form = useForm<CharacterScalar>({
    defaultValues: data,
  })

  const onSubmit = async (data: CharacterScalar) => {
    try {
      setLoading(true)
      await shionlibRequest().patch(`/character/${id}/edit/scalar`, {
        data: {
          ...pick(data, permissions.fields),
          note,
        },
      })
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
      router.push(`/character/${id}`, { scroll: true })
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const [changes, setChanges] = useState<ChangesResult | null>(null)
  const [formValues, setFormValues] = useState<CharacterScalar>(data)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => {
    const subscription = form.watch(values => {
      setFormValues(values as CharacterScalar)
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
          {permissions?.scalarFields.includes('NAMES') && <Names form={form} />}
          {permissions?.scalarFields.includes('ALIASES') && <Aliases form={form} />}
          {permissions?.scalarFields.includes('INTROS') && <Intros form={form} />}
          {permissions?.scalarFields.includes('IMAGE') && <CharacterImage form={form} />}
          {permissions?.scalarFields.includes('BODY_METRICS') && <BodyMetrics form={form} />}
          {permissions?.scalarFields.includes('AGE_BIRTHDAY') && <AgeBirthday form={form} />}
          {permissions?.scalarFields.includes('GENDER') && <Gender form={form} />}
          {permissions?.scalarFields.includes('BLOOD_TYPE') && <BloodType form={form} />}

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
