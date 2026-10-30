'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { Link, useRouter } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { BrandLogo } from '@/components/brand-logo'
import { XPatternBackdrop } from '@/components/x-pattern-backdrop'
import { getPublicApiBase } from '@/lib/public-api'
import { setAccessToken } from '@/lib/auth-token'
import { roleFromAccessToken } from '@/lib/jwt-role'
import { formatApiDetail } from '@/lib/api-detail'

const GOOGLE_CID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

function LoginShell() {
  const t = useTranslations('Auth')
  const locale = useLocale()
  // Phone number for students; email still accepted for admins and older accounts.
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [needsEmailVerify, setNeedsEmailVerify] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const router = useRouter()

  const googleLocale = locale === 'kz' ? 'kk' : locale === 'ru' ? 'ru' : 'en'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNeedsEmailVerify(false)
    setLoading(true)
    try {
      const base = getPublicApiBase()
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password, remember_me: rememberMe }),
      })
      const raw = await res.text()
      if (!res.ok) {
        let msg = t('errorGeneric')
        try {
          const j = JSON.parse(raw) as { detail?: unknown }
          msg = formatApiDetail(j.detail, msg)
        } catch {
          if (raw.trim()) msg = raw.trim().slice(0, 300)
        }
        setError(msg)
        setNeedsEmailVerify(res.status === 403 && msg.includes('Please confirm your email'))
        return
      }
      const data = JSON.parse(raw) as { access_token?: string }
      if (!data.access_token) {
        setError(t('errorGeneric'))
        return
      }
      setAccessToken(data.access_token)
      const role = roleFromAccessToken(data.access_token)
      router.push(role === 'admin' ? '/admin' : '/student')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    if (!login.includes('@') || !password) {
      toast.error(t('errorGeneric'))
      return
    }
    setResendLoading(true)
    try {
      const base = getPublicApiBase()
      const res = await fetch(`${base}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: login.trim(), password }),
      })
      const raw = await res.text()
      if (!res.ok) {
        let msg = t('errorGeneric')
        try {
          const j = JSON.parse(raw) as { detail?: unknown }
          msg = formatApiDetail(j.detail, msg)
        } catch {
          if (raw.trim()) msg = raw.trim().slice(0, 300)
        }
        toast.error(msg)
        return
      }
      const data = JSON.parse(raw) as { already_verified?: boolean }
      if (data.already_verified) {
        toast.success(t('verifyEmailSuccess'))
      } else {
        toast.success(t('resendVerificationSent'))
      }
    } finally {
      setResendLoading(false)
    }
  }

  const onGoogleSuccess = async (credential: string) => {
    setError(null)
    setLoading(true)
    try {
      const base = getPublicApiBase()
      const res = await fetch(`${base}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: credential, remember_me: rememberMe }),
      })
      const raw = await res.text()
      if (!res.ok) {
        let msg = t('errorGeneric')
        try {
          const j = JSON.parse(raw) as { detail?: unknown }
          msg = formatApiDetail(j.detail, msg)
        } catch {
          if (raw.trim()) msg = raw.trim().slice(0, 300)
        }
        setError(msg)
        return
      }
      const data = JSON.parse(raw) as { access_token?: string }
      if (!data.access_token) {
        setError(t('errorGeneric'))
        return
      }
      setAccessToken(data.access_token)
      const role = roleFromAccessToken(data.access_token)
      router.push(role === 'admin' ? '/admin' : '/student')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <XPatternBackdrop>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <div className="mb-6 flex justify-center">
          <LocaleSwitcher />
        </div>

        <Link href="/" className="mb-8 flex justify-center">
          <BrandLogo
            width={280}
            height={80}
            className="h-16 sm:h-20 w-auto max-w-[min(100%,280px)] object-contain object-center"
            priority
          />
        </Link>

        <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-xl backdrop-blur-sm">
          <CardHeader className="space-y-1 px-6 pt-6 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">{t('loginCardTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-destructive">
                  <AlertDescription className="text-foreground font-medium leading-snug">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="login">{t('phoneOrEmail')}</Label>
                <Input
                  id="login"
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder={t('phonePlaceholder')}
                  required
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('passwordPlaceholder')}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    className="pr-11"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 -translate-y-1/2 rounded-full p-1 transition-colors disabled:opacity-40"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading}
                    aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <label htmlFor="remember" className="flex cursor-pointer items-center gap-2.5 font-medium">
                  <Checkbox
                    checked={rememberMe}
                    onCheckedChange={(c) => setRememberMe(c === true)}
                    disabled={loading}
                    id="remember"
                  />
                  <span className="text-foreground leading-snug">{t('staySignedIn')}</span>
                </label>
                <Link
                  href="/auth/forgot-password"
                  className="text-primary shrink-0 font-semibold hover:underline"
                >
                  {t('forgotPassword')}
                </Link>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('signingIn')}
                  </>
                ) : (
                  t('signIn')
                )}
              </Button>
              {needsEmailVerify ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={loading || resendLoading}
                  onClick={() => void handleResendVerification()}
                >
                  {resendLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('resending')}
                    </>
                  ) : (
                    t('resendVerification')
                  )}
                </Button>
              ) : null}
            </form>

            {GOOGLE_CID ? (
              <div className="mt-6 space-y-4">
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-wide">
                    <span className="bg-card text-muted-foreground px-3">{t('authDividerOr')}</span>
                  </div>
                </div>
                <div className="flex w-full justify-center [&>div]:w-full [&_iframe]:!w-full">
                  <GoogleLogin
                    locale={googleLocale}
                    theme="outline"
                    size="large"
                    width={320}
                    text="continue_with"
                    onSuccess={(c) => {
                      if (c.credential) void onGoogleSuccess(c.credential)
                    }}
                    onError={() => setError(t('googleSignInFailed'))}
                  />
                </div>
                <p className="text-muted-foreground text-center text-xs leading-relaxed">{t('googleSameEmailHint')}</p>
              </div>
            ) : null}

            <div className="mt-8 text-center">
              <Link href="/auth/sign-up" className="text-primary text-sm font-semibold hover:underline">
                {t('createAccount')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </XPatternBackdrop>
  )
}

export default function LoginPage() {
  if (GOOGLE_CID) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CID}>
        <LoginShell />
      </GoogleOAuthProvider>
    )
  }
  return <LoginShell />
}
