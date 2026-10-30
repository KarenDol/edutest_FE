"use client"

import { useEffect, useState } from "react"
import { apiClientJson } from "@/lib/client-api"
import { TestsManager } from "@/components/admin/tests-manager"
import type { Subject, Test, TestSection } from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"

type TestWithRelations = Test & {
  subjects: Subject | null
  test_sections?: TestSection[]
  test_questions: {
    id: string
    question_order: number
    questions: { id: string; question_text: string; points: number } | null
  }[]
}

export default function TestsPage() {
  const [tests, setTests] = useState<TestWithRelations[] | null>(null)
  const [subjects, setSubjects] = useState<Subject[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [tList, sList] = await Promise.all([
          apiClientJson<TestWithRelations[]>("/tests"),
          apiClientJson<Subject[]>("/subjects"),
        ])
        if (!cancelled) {
          setTests(tList)
          setSubjects(sList)
        }
      } catch {
        if (!cancelled) {
          setTests([])
          setSubjects([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!tests || !subjects) {
    return (
      <div className="flex min-h-[320px] items-center justify-center p-8">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Сборщик тестов</h1>
        <p className="text-muted-foreground mt-1">
          Секции с таймером — случайный подбор из банка или ручной выбор вопросов
        </p>
      </div>

      <TestsManager initialTests={tests} subjects={subjects} />
    </div>
  )
}
