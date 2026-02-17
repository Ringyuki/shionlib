import { Button } from '@/components/shionui/Button'
import { Upload as UploadIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, useRef, useEffect } from 'react'
import { shionlibRequest } from '@/utils/request'
// import { toast } from 'react-hot-toast'
import { sileo } from 'sileo'
import { useParams } from 'next/navigation'
import { getDims } from '../helpers/getDims'

interface UploadProps {
  onUpload: (url: string, dims: number[]) => void
  onTempUrl?: (url: string) => void
}

export const Upload = ({ onUpload, onTempUrl }: UploadProps) => {
  const t = useTranslations('Components.Game.Edit.Cover.Image.Upload')
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { id: game_id } = useParams()

  useEffect(() => {
    if (file && onTempUrl) {
      onTempUrl(URL.createObjectURL(file))
    }
  }, [file, onTempUrl])

  const handleUpload = async () => {
    if (!file || loading) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await shionlibRequest().fetch<{ key: string }>(
        `/uploads/small/game/${game_id}/cover`,
        {
          method: 'PUT',
          data: formData,
        },
      )
      const dims = await getDims(file)
      onUpload(response.data?.key ?? '', dims)
      setFile(null)
      // toast.success(t('success'))
      sileo.success({ title: t('success') })
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button intent="neutral" appearance="outline" onClick={() => inputRef.current?.click()}>
          {t('select')}
        </Button>
        <Button
          intent="primary"
          disabled={!file}
          loading={loading}
          renderIcon={<UploadIcon />}
          onClick={handleUpload}
        >
          {t('upload')}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={e => setFile(e.target.files?.[0] ?? null)}
      />
    </>
  )
}
