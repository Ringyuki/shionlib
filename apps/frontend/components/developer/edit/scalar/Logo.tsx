'use client'

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/shionui/Form'
import { Input } from '@/components/shionui/Input'
import { useTranslations } from 'next-intl'
import { UseFormReturn } from 'react-hook-form'
import { DeveloperScalar } from '@/interfaces/developer/developer-scalar.interface'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { useState, useRef } from 'react'
import { Button } from '@/components/shionui/Button'
import { Upload as UploadIcon, Building2 } from 'lucide-react'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { useParams } from 'next/navigation'

interface LogoProps {
  form: UseFormReturn<DeveloperScalar>
}

export const Logo = ({ form }: LogoProps) => {
  const t = useTranslations('Components.Developer.Edit.Scalar')
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [tempUrl, setTempUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { id: developer_id } = useParams()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null
    setFile(selectedFile)
    if (selectedFile) {
      setTempUrl(URL.createObjectURL(selectedFile))
    }
  }

  const handleUpload = async () => {
    if (!file || loading) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await shionlibRequest().fetch<{ key: string }>(
        `/uploads/small/developer/${developer_id}/logo`,
        {
          method: 'PUT',
          data: formData,
        },
      )
      form.setValue('logo', response.data?.key ?? '')
      setFile(null)
      setTempUrl(null)
      // toast.success(t('upload_success'))
      sileo.success({ title: t('upload_success') })
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const logoUrl = form.watch('logo')

  return (
    <FormField
      control={form.control}
      name="logo"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('logo')}</FormLabel>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 md:w-32 md:h-32 overflow-hidden bg-muted rounded-md shrink-0 flex items-center justify-center">
              {tempUrl || logoUrl ? (
                <FadeImage
                  src={tempUrl ?? logoUrl}
                  alt={t('logo')}
                  imageClassName="object-contain h-full w-full"
                />
              ) : (
                <Building2 className="size-10 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2 w-full">
              <FormControl>
                <Input {...field} readOnly placeholder="https://..." />
              </FormControl>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  intent="neutral"
                  appearance="outline"
                  onClick={() => inputRef.current?.click()}
                >
                  {t('select_file')}
                </Button>
                <Button
                  type="button"
                  intent="primary"
                  disabled={!file}
                  loading={loading}
                  renderIcon={<UploadIcon />}
                  onClick={handleUpload}
                >
                  {t('upload')}
                </Button>
              </div>
              <FormMessage />
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
        </FormItem>
      )}
    />
  )
}
