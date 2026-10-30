'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { getPublicApiBase } from '@/lib/public-api'
import { formatApiDetail } from '@/lib/api-detail'

const POLL_MS = 2000

type Props = {
  purpose: 'register' | 'reset'
  /** Called once the bot has the phone; the token is single-use for /auth/register or /auth/reset-password. */
  onVerified: (verificationToken: string, phone: string) => void
}

type BotSession = { session_id: string; poll_secret: string; bot_url: string }

type PollResult =
  | { status: 'pending' | 'expired' }
  | { status: 'verified'; verification_token: string; phone: string }
  | { status: 'error'; detail: string }

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getPublicApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const raw = await res.text()
  if (res.ok) return JSON.parse(raw) as T
  let msg = ''
  try {
    msg = formatApiDetail((JSON.parse(raw) as { detail?: unknown }).detail, '')
  } catch {
    msg = raw.trim().slice(0, 300)
  }
  throw new Error(msg)
}

/** Phone verification through @edutest_narxoz_bot: the student shares their Telegram contact with the bot. */
export function TelegramPhoneVerify({ purpose, onVerified }: Props) {
  const t = useTranslations('Auth')
  const [session, setSession] = useState<BotSession | null>(null)
  const [expired, setExpired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const onVerifiedRef = useRef(onVerified)
  onVerifiedRef.current = onVerified

  const startSession = useCallback(async () => {
    setError(null)
    setExpired(false)
    setLoading(true)
    try {
      setSession(await postJson<BotSession>('/auth/telegram/start', { purpose }))
    } catch (e) {
      setSession(null)
      setError((e instanceof Error && e.message) || t('errorGeneric'))
    } finally {
      setLoading(false)
    }
  }, [purpose, t])

  useEffect(() => {
    void startSession()
  }, [startSession])

  useEffect(() => {
    if (!session || expired || error) return
    let stopped = false
    const timer = window.setInterval(async () => {
      if (document.hidden) return
      try {
        const r = await postJson<PollResult>('/auth/telegram/poll', {
          session_id: session.session_id,
          poll_secret: session.poll_secret,
        })
        if (stopped) return
        if (r.status === 'verified') {
          stopped = true
          window.clearInterval(timer)
          onVerifiedRef.current(r.verification_token, r.phone)
        } else if (r.status === 'error') {
          setError(r.detail)
        } else if (r.status === 'expired') {
          setExpired(true)
        }
      } catch {
        // transient network error: keep polling
      }
    }, POLL_MS)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [session, expired, error])

  if (loading && !session) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || expired || !session) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive" className="border-destructive">
          <AlertDescription className="text-foreground font-medium leading-snug">
            {error ?? t('telegramLinkExpired')}
          </AlertDescription>
        </Alert>
        <Button type="button" className="w-full" onClick={() => void startSession()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('newTelegramLink')}
        </Button>
      </div>
    )
  }

  const bot = `@${new URL(session.bot_url).pathname.replace(/^\//, '')}`
  const steps = [t('tgStep1', { bot }), t('tgStep2'), t('tgStep3'), t('tgStep4')]

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="font-semibold">{t('tgTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('telegramVerifyHint')}</p>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ol className="flex-1 space-y-3">
          {steps.map((text, i) => (
            <li key={i} className="flex gap-3 text-sm leading-snug">
              <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {i + 1}
              </span>
              <span className="pt-0.5">{text}</span>
            </li>
          ))}
        </ol>
        <div className="hidden shrink-0 flex-col items-center gap-2 sm:flex">
          <div className="rounded-lg border bg-white p-2">
            <QRCodeSVG value={session.bot_url} size={148} level="M" />
          </div>
          <p className="max-w-[164px] text-center text-xs text-muted-foreground">{t('tgScanQr')}</p>
        </div>
      </div>

      <Button asChild className="w-full" size="lg">
        <a href={session.bot_url} target="_blank" rel="noopener noreferrer">
          <Send className="mr-2 h-4 w-4" />
          {t('openTelegramBot', { bot })}
        </a>
      </Button>

      <div className="flex items-center justify-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('waitingForTelegram')}
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <p className="flex items-start gap-1.5">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />
          {t('tgPrivacy')}
        </p>
        <p>
          {t('tgLinkValid')}{' '}
          {t('tgNoTelegram')}{' '}
          <a href="https://telegram.org/apps" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
            {t('tgInstall')}
          </a>
        </p>
      </div>
    </div>
  )
}
