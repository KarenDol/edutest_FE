'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Loader2 } from 'lucide-react'
import { getPublicApiBase } from '@/lib/public-api'
import { formatApiDetail } from '@/lib/api-detail'

const CODE_LENGTH = 6

type Props = {
  purpose: 'register' | 'reset'
  /** Called once Telegram confirms the code; the token is single-use for /auth/register or /auth/reset-password. */
  onVerified: (verificationToken: string, phone: string) => void
}

async function postJson<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string | null }> {
  const res = await fetch(`${getPublicApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  if (res.ok) return { ok: true, data: JSON.parse(raw) as T }
  try {
    const j = JSON.parse(raw) as { detail?: unknown }
    return { ok: false, error: formatApiDetail(j.detail, '') || null }
  } catch {
    return { ok: false, error: raw.trim() ? raw.trim().slice(0, 300) : null }
  }
}

/** Phone number → Telegram code (Telegram Gateway) step used by sign-up and password reset. */
export function TelegramPhoneVerify({ purpose, onVerified }: Props) {
  const t = useTranslations('Auth')
  const [phone, setPhone] = useState('+7')
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState('')
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn])

  const sendCode = async () => {
    setError(null)
    setLoading(true)
    try {
      const r = await postJson<{ verification_id: string; phone: string; resend_in: number }>(
        '/auth/phone/send-code',
        { phone, purpose },
      )
      if (!r.ok) {
        setError(r.error ?? t('errorGeneric'))
        return
      }
      setVerificationId(r.data.verification_id)
      setSentTo(r.data.phone)
      setResendIn(r.data.resend_in)
      setCode('')
    } catch {
      setError(t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async (value: string) => {
    if (!verificationId || value.length !== CODE_LENGTH) return
    setError(null)
    setLoading(true)
    try {
      const r = await postJson<{ verification_token: string; phone: string }>('/auth/phone/verify', {
        verification_id: verificationId,
        code: value,
      })
      if (!r.ok) {
        setError(r.error ?? t('errorGeneric'))
        setCode('')
        return
      }
      onVerified(r.data.verification_token, r.data.phone)
    } catch {
      setError(t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }

  const errorAlert = error ? (
    <Alert variant="destructive" className="border-destructive">
      <AlertDescription className="text-foreground font-medium leading-snug">{error}</AlertDescription>
    </Alert>
  ) : null

  if (!verificationId) {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void sendCode()
        }}
      >
        {errorAlert}
        <div className="space-y-2">
          <Label htmlFor="phone">{t('phone')}</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('phonePlaceholder')}
            required
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">{t('phoneTelegramHint')}</p>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('sendingCode')}
            </>
          ) : (
            t('sendTelegramCode')
          )}
        </Button>
      </form>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void verifyCode(code)
      }}
    >
      {errorAlert}
      <p className="text-sm text-muted-foreground">{t('codeSentTo', { phone: sentTo })}</p>
      <div className="flex justify-center">
        <InputOTP
          maxLength={CODE_LENGTH}
          value={code}
          onChange={setCode}
          onComplete={(v: string) => void verifyCode(v)}
          disabled={loading}
          autoFocus
        >
          <InputOTPGroup>
            {Array.from({ length: CODE_LENGTH }, (_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>
      <Button type="submit" className="w-full" disabled={loading || code.length !== CODE_LENGTH}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {t('confirmCode')}
      </Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          className="text-primary font-medium hover:underline disabled:opacity-50"
          disabled={loading}
          onClick={() => {
            setVerificationId(null)
            setError(null)
          }}
        >
          {t('changePhone')}
        </button>
        <button
          type="button"
          className="text-primary font-medium hover:underline disabled:text-muted-foreground disabled:no-underline"
          disabled={loading || resendIn > 0}
          onClick={() => void sendCode()}
        >
          {resendIn > 0 ? t('resendCodeIn', { seconds: resendIn }) : t('resendCode')}
        </button>
      </div>
    </form>
  )
}
