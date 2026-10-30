"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { LocaleSwitcher } from "@/components/locale-switcher"
import { BrandLogo } from "@/components/brand-logo"
import { XPatternBackdrop } from "@/components/x-pattern-backdrop"
import { TelegramPhoneVerify } from "@/components/auth/telegram-phone-verify"
import { getPublicApiBase } from "@/lib/public-api"
import { formatApiDetail } from "@/lib/api-detail"

export default function ForgotPasswordPage() {
  const t = useTranslations("Auth")
  const router = useRouter()
  const [verificationToken, setVerificationToken] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${getPublicApiBase()}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification_token: verificationToken, password }),
      })
      if (!res.ok) {
        const raw = await res.text()
        let msg = t("errorGeneric")
        try {
          const j = JSON.parse(raw) as { detail?: unknown }
          msg = formatApiDetail(j.detail, msg)
        } catch {
          if (raw.trim()) msg = raw.trim().slice(0, 300)
        }
        setError(msg)
        if (msg.startsWith("Phone verification expired")) setVerificationToken(null)
        return
      }
      toast.success(t("passwordResetDone"))
      router.push("/auth/login")
    } catch {
      setError(t("errorGeneric"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <XPatternBackdrop>
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="mb-6 flex justify-center">
          <LocaleSwitcher />
        </div>
        <Link href="/" className="mb-8 flex justify-center">
          <BrandLogo
            width={220}
            height={64}
            className="h-14 w-auto max-w-[min(100%,240px)] object-contain"
            priority
          />
        </Link>
        <Card className="w-full max-w-md border-border/80 bg-card/95 shadow-xl backdrop-blur-sm">
          <CardHeader className="space-y-2 px-6 pt-6 text-left">
            <CardTitle className="text-2xl font-bold tracking-tight">{t("forgotPasswordTitle")}</CardTitle>
            <CardDescription className="text-base leading-relaxed">{t("forgotPasswordDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-6 pb-6">
            {!verificationToken ? (
              <TelegramPhoneVerify purpose="reset" onVerified={(token) => setVerificationToken(token)} />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="border-destructive">
                    <AlertDescription className="text-foreground font-medium leading-snug">{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">{t("newPassword")}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading}
                    autoComplete="new-password"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {t("saveNewPassword")}
                </Button>
              </form>
            )}
            <Button asChild variant="ghost" className="w-full">
              <Link href="/auth/login">{t("backToLogin")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </XPatternBackdrop>
  )
}
