'use client'

import type { DeveloperScalar } from '@/interfaces/developer/developer-scalar.interface'
import { Form } from '@/components/shionui/Form'
import { Name } from './scalar/Name'
import { Aliases } from './scalar/Aliases'
import { Intros } from './scalar/Intros'
import { ExtraInfo } from './scalar/ExtraInfo'
import { Logo } from './scalar/Logo'
import { Website } from './scalar/Website'
import { useForm } from 'react-hook-form'
import { useEditPermissionStore } from '@/store/editPermissionStore'
import { Button } from '@/components/shionui/Button'
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { shionlibRequest } from '@/utils/request'
import { useParams } from 'next/navigation'
import { sileo } from 'sileo'
import { useRouter } from '@/i18n/navigation.client'
import { pickChanges, ChangesResult } from '@/utils/pick-changes'
import { Confirm } from './scalar/Confirm'
import { EditNote } from './EditNote'
import { redirect } from 'next/navigation'
import { pick } from './helper/pick'
import { isScalarValueEqual, mergeScalarFields } from '@/components/edit/sync/scalar-form-sync'
import { useFieldSyncAppliedEvent } from './sync/field-sync-events'
import { scalarSyncValueFields } from './types/field-sync'
import type { FieldSyncTarget } from './types/field-sync'

interface ScalarProps {
  data: DeveloperScalar
}

export const DeveloperScalarEdit = ({ data }: ScalarProps) => {
  const t = useTranslations('Components.Developer.Edit.Scalar')
  const { developerPermissions: permissions } = useEditPermissionStore()
  const { id } = useParams()
  if (!permissions) {
    redirect(`/developer/${id}`)
  }

  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const form = useForm<DeveloperScalar>({
    defaultValues: data,
  })

  const onSubmit = async (data: DeveloperScalar) => {
    try {
      setLoading(true)
      await shionlibRequest().patch(`/developer/${id}/edit/scalar`, {
        data: {
          ...pick(data, permissions.fields),
          note,
        },
      })
      sileo.success({ title: t('success') })
      router.push(`/developer/${id}`, { scroll: true })
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const [changes, setChanges] = useState<ChangesResult | null>(null)
  const [baseline, setBaseline] = useState<DeveloperScalar>(data)
  const [formValues, setFormValues] = useState<DeveloperScalar>(data)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const fetchScalar = useCallback(
    async (syncedFields: FieldSyncTarget | FieldSyncTarget[]) => {
      try {
        const res = await shionlibRequest().get<DeveloperScalar>(`/edit/developer/${id}/scalar`)
        if (res.data === null) return
        const syncedData = res.data
        const fields = [
          ...new Set([syncedFields].flat().flatMap(field => scalarSyncValueFields[field])),
        ]
        const nextValues = mergeScalarFields(
          form.getValues(),
          syncedData,
          fields,
          scalarField => !isScalarValueEqual(baseline[scalarField], syncedData[scalarField]),
        )
        setBaseline(mergeScalarFields(baseline, syncedData, fields))
        form.reset(nextValues)
        setFormValues(nextValues)
      } catch {}
    },
    [baseline, form, id],
  )
  const handleFieldSyncApplied = useCallback(
    (fields: FieldSyncTarget[]) => {
      if (fields.length > 0) void fetchScalar(fields)
    },
    [fetchScalar],
  )
  useFieldSyncAppliedEvent(handleFieldSyncApplied)
  useEffect(() => {
    const subscription = form.watch(values => {
      setFormValues(values as DeveloperScalar)
    })
    return () => subscription.unsubscribe()
  }, [form])
  useEffect(() => {
    const { field_changes, before, after } = pickChanges(formValues, baseline)
    setChanges({ field_changes, before, after })
  }, [formValues, baseline])
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
          {permissions?.scalarFields.includes('NAME') && <Name form={form} />}
          {permissions?.scalarFields.includes('ALIASES') && <Aliases form={form} />}
          {permissions?.scalarFields.includes('INTROS') && <Intros form={form} />}
          {permissions?.scalarFields.includes('EXTRA') && <ExtraInfo form={form} />}
          {permissions?.scalarFields.includes('LOGO') && <Logo form={form} />}
          {permissions?.scalarFields.includes('WEBSITE') && <Website form={form} />}

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
