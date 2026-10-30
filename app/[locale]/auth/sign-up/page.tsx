'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { LocaleSwitcher } from '@/components/locale-switcher'
import { BrandLogo } from '@/components/brand-logo'
import { XPatternBackdrop } from '@/components/x-pattern-backdrop'
import { getPublicApiBase } from '@/lib/public-api'
import { setAccessToken } from '@/lib/auth-token'
import { formatApiDetail } from '@/lib/api-detail'
import { TelegramPhoneVerify } from '@/components/auth/telegram-phone-verify'

type EntProfile = 'FIZMAT' | 'CHEMBIO'
const GRADES = ['9', '10', '11', '12'] as const

function schoolGradeLabel(g: (typeof GRADES)[number], t: (key: string) => string) {
  return t(`schoolClassGrade${g}`)
}

export default function SignUpPage() {
  const t = useTranslations('Auth')

  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [patronymic, setPatronymic] = useState('')
  const [iin, setIin] = useState('')
  const [verificationToken, setVerificationToken] = useState<string | null>(null)
  const [verifiedPhone, setVerifiedPhone] = useState('')
  const [schoolClass, setSchoolClass] = useState<(typeof GRADES)[number] | ''>('')
  const [schoolName, setSchoolName] = useState('')
  const [entProfile, setEntProfile] = useState<EntProfile>('FIZMAT')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!error) return
    const timer = window.setTimeout(() => setError(null), 5000)
    return () => window.clearTimeout(timer)
  }, [error])

  const onIinChange = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 12)
    setIin(digits)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (iin.length !== 12) {
      const msg = t('errorGeneric')
      setError(msg)
      toast.error(msg, { duration: 5000 })
      return
    }
    if (!schoolClass) {
      const msg = t('schoolClassRequired')
      setError(msg)
      toast.error(msg, { duration: 5000 })
      return
    }
    setLoading(true)

    try {
      const base = getPublicApiBase()
      const res = await fetch(`${base}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verification_token: verificationToken,
          password,
          last_name: lastName.trim(),
          first_name: firstName.trim(),
          patronymic: patronymic.trim() || null,
          iin,
          school_class: schoolClass,
          school_name: schoolName.trim(),
          ent_profile: entProfile,
        }),
      })

      const raw = await res.text()

      if (!res.ok) {
        let errMsg: string
        try {
          const j = JSON.parse(raw) as { detail?: unknown }
          errMsg = formatApiDetail(j.detail, t('errorGeneric'))
        } catch {
          errMsg = raw.trim() ? raw.trim().slice(0, 300) : t('errorGeneric')
        }
        setError(errMsg)
        toast.error(errMsg, { duration: 5000 })
        if (errMsg.startsWith('Phone verification expired')) setVerificationToken(null)
        return
      }

      const data = JSON.parse(raw) as {
        access_token?: string
        pending_email_verification?: boolean
      }
      if (data.pending_email_verification) {
        router.push('/auth/sign-up-success?verify=1')
        router.refresh()
        return
      }
      if (data.access_token) {
        setAccessToken(data.access_token)
      }
      router.push('/student')
      router.refresh()
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes('NEXT_PUBLIC_API_URL')
          ? t('errorGeneric')
          : err instanceof Error
            ? err.message
            : t('errorGeneric')
      setError(msg)
      toast.error(msg, { duration: 5000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <XPatternBackdrop>
      <div className="min-h-screen flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-lg border-border/80 bg-card/95 shadow-xl backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <LocaleSwitcher />
          </div>
          <Link href="/" className="flex justify-center mb-6">
            <BrandLogo
              width={280}
              height={80}
              className="h-16 sm:h-20 w-auto max-w-[min(100%,280px)] object-contain object-center"
              priority
            />
          </Link>
          <CardTitle className="text-2xl">{t('signUpTitle')}</CardTitle>
          <CardDescription>{t('signUpSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!verificationToken ? (
            <TelegramPhoneVerify
              purpose="register"
              onVerified={(token, phone) => {
                setVerificationToken(token)
                setVerifiedPhone(phone)
              }}
            />
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-destructive">
                <AlertDescription className="text-foreground font-medium leading-snug">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('lastName')}</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={loading}
                  placeholder={t('lastNamePlaceholder')}
                  autoComplete="family-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('firstName')}</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={loading}
                  placeholder={t('firstNamePlaceholder')}
                  autoComplete="given-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="patronymic">
                {t('patronymic')}{' '}
                <span className="text-muted-foreground font-normal">({t('patronymicOptional')})</span>
              </Label>
              <Input
                id="patronymic"
                value={patronymic}
                onChange={(e) => setPatronymic(e.target.value)}
                disabled={loading}
                placeholder={t('patronymicPlaceholder')}
                autoComplete="additional-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="iin">{t('iin')}</Label>
              <Input
                id="iin"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                value={iin}
                onChange={(e) => onIinChange(e.target.value)}
                required
                disabled={loading}
                placeholder="000000000000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('phone')}</Label>
              <Input id="phone" type="tel" value={verifiedPhone} readOnly disabled />
              <p className="text-xs text-muted-foreground">{t('phoneVerified')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="schoolClass">{t('schoolClass')}</Label>
              <Select
                value={schoolClass || undefined}
                onValueChange={(v) => setSchoolClass(v as (typeof GRADES)[number])}
                disabled={loading}
                required
              >
                <SelectTrigger id="schoolClass" className="w-full">
                  <SelectValue placeholder={t('schoolClassPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {schoolGradeLabel(g, t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="schoolName">{t('schoolName')}</Label>
              <Input
                id="schoolName"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('entProfile')}</Label>
              <Select value={entProfile} onValueChange={(v) => setEntProfile(v as EntProfile)} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIZMAT">{t('entFizmat')}</SelectItem>
                  <SelectItem value="CHEMBIO">{t('entChembio')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('creating')}
                </>
              ) : (
                t('createAccount')
              )}
            </Button>
          </form>
          )}

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">{t('hasAccount')} </span>
            <Link href="/auth/login" className="text-primary hover:underline font-medium">
              {t('loginLink')}
            </Link>
          </div>
        </CardContent>
      </Card>
      </div>
    </XPatternBackdrop>
  )
}
