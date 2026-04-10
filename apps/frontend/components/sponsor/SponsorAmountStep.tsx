'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/shionui/Button'
import { Input } from '@/components/shionui/Input'
import { InputNumber } from '@/components/shionui/InputNumber'
import { Textarea } from '@/components/shionui/Textarea'
import { Checkbox } from '@/components/shionui/Checkbox'
import { Label } from '@/components/shionui/Label'
import { cn } from '@/utils/cn'
import { useShionlibUserStore } from '@/store/userStore'
import { PRESET_AMOUNTS } from './constants/sponsor'
import { DollarSign } from 'lucide-react'

interface SponsorAmountStepProps {
  onNext: (data: { amount: number; name: string; message: string; isPrivate: boolean }) => void
  loading: boolean
}

export const SponsorAmountStep = ({ onNext, loading }: SponsorAmountStepProps) => {
  const t = useTranslations('Components.Sponsor.SponsorModal')
  const [selectedAmount, setSelectedAmount] = useState<number | null>(5)
  const [customAmount, setCustomAmount] = useState(1)
  const [isCustom, setIsCustom] = useState(false)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const shionlibUserStore = useShionlibUserStore()
  const isLoggedIn = !!shionlibUserStore.getUser().id

  const amount = isCustom ? Number(customAmount) : selectedAmount

  const handlePresetClick = (value: number) => {
    setSelectedAmount(value)
    setIsCustom(false)
    setCustomAmount(value)
  }

  const handleCustomClick = () => {
    setIsCustom(true)
    setSelectedAmount(null)
  }

  const handleSubmit = () => {
    if (!amount || amount < 1) return
    onNext({ amount, name, message, isPrivate })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium mb-2">{t('amount-title')}</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_AMOUNTS.map(value => (
            <button
              key={value}
              type="button"
              onClick={() => handlePresetClick(value)}
              className={cn(
                'rounded-lg border py-2.5 font-medium transition-colors cursor-pointer',
                'flex items-center justify-center',
                !isCustom && selectedAmount === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50',
              )}
            >
              <DollarSign className="size-3" />
              {value}
            </button>
          ))}
          <button
            type="button"
            onClick={handleCustomClick}
            className={cn(
              'rounded-lg border py-2.5 text-sm font-medium transition-colors cursor-pointer',
              isCustom
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50',
            )}
          >
            {t('amount-custom')}
          </button>
        </div>
        {isCustom && (
          <div className="mt-2">
            <InputNumber
              min={5}
              max={10000}
              placeholder="1 - 10000"
              value={customAmount}
              onChange={value => setCustomAmount(value ?? 1)}
              autoFocus
              prefix={<DollarSign className="size-3" />}
            />
          </div>
        )}
      </div>
      <div className="space-y-2">
        {!isLoggedIn && (
          <Input
            placeholder={t('name-placeholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={100}
          />
        )}
        <Textarea
          placeholder={t('message-placeholder')}
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={500}
          rows={2}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="sponsor-private"
          checked={isPrivate}
          onCheckedChange={checked => setIsPrivate(checked === true)}
        />
        <Label htmlFor="sponsor-private" className="text-sm cursor-pointer">
          {t('private-label')}
        </Label>
      </div>

      <Button className="w-full" onClick={handleSubmit} disabled={!amount} loading={loading}>
        {t('next')}
      </Button>
    </div>
  )
}
