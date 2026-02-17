import { Button } from '@/components/shionui/Button'
import { Upload as UploadIcon } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'

interface ImageUploadProps {
  onUpload: (imageKey: string) => void
  onTempUrl?: (url: string | null) => void
}

export const ImageUpload = ({ onUpload, onTempUrl }: ImageUploadProps) => {
  const t = useTranslations('Components.Game.Edit.Character.Image.Upload')
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { id: character_id } = useParams()

  useEffect(() => {
    if (file && onTempUrl) {
      onTempUrl(URL.createObjectURL(file))
    } else if (!file && onTempUrl) {
      onTempUrl(null)
    }
  }, [file, onTempUrl])

  const handleUpload = async () => {
    if (!file || loading) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await shionlibRequest().fetch<{ key: string }>(
        `/uploads/small/character/${character_id}/image`,
        {
          method: 'PUT',
          data: formData,
        },
      )
      if (response.data?.key) {
        onUpload(response.data.key)
        setFile(null)
        // toast.success(t('success'))
        sileo.success({ title: t('success') })
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          intent="neutral"
          appearance="outline"
          onClick={() => inputRef.current?.click()}
        >
          {t('select')}
        </Button>
        <Button
          type="button"
          intent="primary"
          disabled={!file}
          loading={loading}
          renderIcon={<UploadIcon className="size-4" />}
          onClick={handleUpload}
        >
          {t('upload')}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={e => setFile(e.target.files?.[0] ?? null)}
      />
    </>
  )
}
