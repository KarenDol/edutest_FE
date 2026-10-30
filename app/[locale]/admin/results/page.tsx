"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { apiClientJson } from "@/lib/client-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

type AdminSubmission = {
  id: string
  total_score: number
  max_score: number
  percentage: number
  submitted_at: string | null
  profiles: { name: string | null; email: string | null; phone?: string | null }
  tests: { title: string | null; subjects: { name: string } | null }
}

export default function ResultsPage() {
  const t = useTranslations("AdminResults")
  const [submissions, setSubmissions] = useState<AdminSubmission[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await apiClientJson<AdminSubmission[]>("/submissions/admin-completed")
        if (!cancelled) setSubmissions(list)
      } catch {
        if (!cancelled) setSubmissions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!submissions) {
    return (
      <div className="flex min-h-[320px] items-center justify-center p-8">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const getScoreBadgeVariant = (percentage: number) => {
    if (percentage >= 80) return "default" as const
    if (percentage >= 60) return "secondary" as const
    return "destructive" as const
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("tableTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions && submissions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colStudent")}</TableHead>
                  <TableHead>{t("colTest")}</TableHead>
                  <TableHead>{t("colSubject")}</TableHead>
                  <TableHead>{t("colScore")}</TableHead>
                  <TableHead>{t("colPct")}</TableHead>
                  <TableHead>{t("colSubmitted")}</TableHead>
                  <TableHead className="text-right">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{submission.profiles?.name || t("unknownStudent")}</p>
                        <p className="text-sm text-muted-foreground">{submission.profiles?.phone ?? submission.profiles?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {submission.tests?.title || t("unknownTest")}
                    </TableCell>
                    <TableCell>
                      {submission.tests?.subjects?.name ? (
                        <Badge variant="secondary">{submission.tests.subjects.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {submission.total_score} / {submission.max_score}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getScoreBadgeVariant(submission.percentage || 0)}>
                        {submission.percentage?.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/admin/results/${submission.id}`}>{t("viewDetail")}</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-muted-foreground">{t("empty")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
