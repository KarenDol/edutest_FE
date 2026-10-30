"use client"

import { useEffect, useState } from "react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { apiClientJson } from "@/lib/client-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import type { QuestionReportAdmin } from "@/lib/types"

export default function AdminQuestionReportsPage() {
  const t = useTranslations("AdminQuestionReports")
  const tReasons = useTranslations("QuestionReport.reasons")
  const [reports, setReports] = useState<QuestionReportAdmin[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await apiClientJson<QuestionReportAdmin[]>("/question-reports")
        if (!cancelled) setReports(rows)
      } catch {
        if (!cancelled) setReports([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!reports) {
    return (
      <div className="flex min-h-[320px] items-center justify-center p-8">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      {reports.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{t("empty")}</p>
      ) : (
        <div className="space-y-4">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold">
                    {r.test?.title ?? t("unknownTest")}
                  </CardTitle>
                  <Badge variant="outline">{tReasons(r.reason)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">{t("student")}: </span>
                  {r.reporter?.name || r.reporter?.phone || r.reporter?.email || "—"}
                </p>
                <p className="line-clamp-2">
                  <span className="text-muted-foreground">{t("question")}: </span>
                  {r.question_preview || "—"}
                </p>
                {r.comment && (
                  <p className="rounded-md bg-muted/50 p-2 text-muted-foreground">{r.comment}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                  {" · "}
                  <Link
                    href={`/admin/results/${r.submission_id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {t("viewAttempt")}
                  </Link>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
