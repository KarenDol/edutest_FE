"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiClientJson } from "@/lib/client-api"
import { Spinner } from "@/components/ui/spinner"
import { TestTakingInterface } from "@/components/student/test-taking-interface"
import type { Question, Submission, Test, TestSection } from "@/lib/types"

type TestPayload = Test & {
  subjects: { name: string } | null
  test_sections?: TestSection[]
  test_questions: {
    id: string
    section_id?: string | null
    question_order: number
    questions: {
      id: string
      question_text: string
      question_type: Question["question_type"]
      options: string[]
      correct_answers: number[]
      points: number
      shuffle_answer_options?: boolean
      show_calculator?: boolean
      show_periodic_table?: boolean
      math?: Question["math"]
    } | null
  }[]
}

export default function TakeTestBody() {
  const params = useParams()
  const router = useRouter()
  const id = String(params.id ?? "")
  const [ready, setReady] = useState(false)
  const [payload, setPayload] = useState<{
    test: TestPayload
    existingSubmission: Submission | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const test = await apiClientJson<TestPayload>(`/tests/${id}`)
        const inProgress = await apiClientJson<{ submission: Submission | null }>(
          `/tests/${id}/in-progress-submission`,
        )
        if (cancelled) return
        setPayload({ test, existingSubmission: inProgress.submission })
      } catch {
        router.replace("/student/tests")
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, router])

  if (!ready || !payload) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const { test, existingSubmission } = payload
  const sortedQuestions = test.test_questions
    .sort((a, b) => a.question_order - b.question_order)
    .map((tq) => {
      const q = tq.questions
      if (!q) return null
      return { ...q, section_id: tq.section_id ?? null }
    })
    .filter(Boolean) as (Question & { section_id?: string | null })[]

  return (
    <div className="-mx-6 -my-8 min-h-screen bg-background md:-mx-10 md:-my-10">
      <TestTakingInterface
        test={{
          ...test,
          test_sections: test.test_sections,
          questions: sortedQuestions,
        }}
        existingSubmission={existingSubmission}
      />
    </div>
  )
}
