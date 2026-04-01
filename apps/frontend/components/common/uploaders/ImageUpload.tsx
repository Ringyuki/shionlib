'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/shionui/Button'
import { Input } from '@/components/shionui/Input'
import { FadeImage } from '@/components/common/shared/FadeImage'
import { Upload as UploadIcon, ImageIcon } from 'lucide-react'
import { shionlibRequest } from '@/utils/request'
import { cn } from '@/utils/cn'

interface ImageUploadProps {
  /** PUT endpoint path, e.g. `/uploads/small/ad/image` */
  endpoint: string
  /** Current image URL (for preview and input display) */
  value?: string | null
  /** Called with the S3 key after successful upload */
  onUpload: (key: string) => void
  /** Called when the input value changes manually */
  onValueChange?: (value: string) => void
  /** Label for the select button */
  selectLabel?: string
  /** Label for the upload button */
  uploadLabel?: string
  /** Success callback */
  onSuccess?: () => void
  /** Error callback */
  onError?: () => void
  /** Accepted file types */
  accept?: string
  /** Preview container className */
  previewClassName?: string
  /** Whether to show the preview area */
  showPreview?: boolean
  /** Whether to show the URL input field */
  showInput?: boolean
  /** Whether the input is read-only */
  readOnly?: boolean
  /** Input placeholder */
  placeholder?: string
  disabled?: boolean
}

export const ImageUpload = ({
  endpoint,
  value,
  onUpload,
  onValueChange,
  selectLabel = 'Select',
  uploadLabel = 'Upload',
  onSuccess,
  onError,
  accept = 'image/jpeg,image/png,image/webp,image/avif',
  previewClassName,
  showPreview = true,
  showInput = false,
  readOnly = false,
  placeholder = 'https://...',
  disabled = false,
}: ImageUploadProps) => {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [tempUrl, setTempUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setTempUrl(selected ? URL.createObjectURL(selected) : null)
  }, [])

  const handleUpload = useCallback(async () => {
    if (!file || loading || disabled) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await shionlibRequest().fetch<{ key: string }>(endpoint, {
        method: 'PUT',
        data: formData,
      })
      const key = res.data?.key
      if (key) {
        onUpload(key)
        setFile(null)
        setTempUrl(null)
        onSuccess?.()
      }
    } catch {
      onError?.()
    } finally {
      setLoading(false)
    }
  }, [file, loading, disabled, endpoint, onUpload, onSuccess, onError])

  const previewSrc = tempUrl ?? value

  return (
    <div className="flex items-center gap-4">
      {showPreview && (
        <div
          className={cn(
            'overflow-hidden bg-muted rounded-md shrink-0 flex items-center justify-center',
            previewClassName ?? 'w-24 h-24 md:w-32 md:h-32',
          )}
        >
          {previewSrc ? (
            <FadeImage
              src={previewSrc}
              alt="preview"
              imageClassName="object-contain h-full w-full"
            />
          ) : (
            <ImageIcon className="size-10 text-muted-foreground" />
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 w-full">
        {showInput && (
          <Input
            value={value ?? ''}
            readOnly={readOnly}
            placeholder={placeholder}
            onChange={e => onValueChange?.(e.target.value)}
          />
        )}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            intent="neutral"
            appearance="outline"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            {selectLabel}
          </Button>
          <Button
            type="button"
            intent="primary"
            disabled={!file || disabled}
            loading={loading}
            renderIcon={<UploadIcon />}
            onClick={handleUpload}
          >
            {uploadLabel}
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={handleFileChange}
      />
    </div>
  )
}
