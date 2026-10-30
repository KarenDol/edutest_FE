"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import { apiClientJson } from "@/lib/client-api"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { ArrowLeft } from "lucide-react"
import {
  SubmissionResultReview,
  type SubmissionDetail,
} from "@/components/submission-result-review"
import { ProctoringReview } from "@/components/admin/proctoring-review"

export default function AdminResultIdBody() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations("AdminResults")
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSubmission()
  }, [params.id])

  async function fetchSubmission() {
    try {
      const data = await apiClientJson<SubmissionDetail>(`/submissions/${params.id}`)
      setSubmission(data)
    } catch {
      router.push("/admin/results")
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!submission || !submission.tests) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-xl font-bold">{t("notFound")}</h2>
        <Button asChild className="mt-4">
          <Link href="/admin/results">{t("backToList")}</Link>
        </Button>
      </div>
    )
  }

  const name = submission.profiles?.name || t("unknownStudent")
  const email = submission.profiles?.phone ?? submission.profiles?.email

  return (
    <div className="space-y-10 px-6 py-8 md:px-10 md:py-10">
      <div className="flex items-start gap-5 md:gap-6">
        <Button variant="ghost" size="icon" asChild className="mt-1 shrink-0">
          <Link href="/admin/results">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-foreground">
            {submission.tests.title}
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed">{t("detailSubtitle")}</p>
          <p className="text-foreground text-sm font-semibold leading-relaxed">
            {t("studentLabel")}: {name}
            {email ? (
              <span className="ml-2 font-normal text-muted-foreground">({email})</span>
            ) : null}
          </p>
        </div>
      </div>

      <SubmissionResultReview submission={submission} />

      <ProctoringReview submissionId={submission.id} />

      <div className="flex justify-center">
        <Button variant="outline" asChild>
          <Link href="/admin/results">{t("backToList")}</Link>
        </Button>
      </div>
    </div>
  )
}
