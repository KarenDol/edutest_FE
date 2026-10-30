"use client"

import { useCallback, useEffect, useState } from "react"
import { useTranslations, useLocale } from "next-intl"
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
import type { StudentListItem } from "@/lib/types"
import { Spinner } from "@/components/ui/spinner"

function displayName(s: StudentListItem): string {
  if (s.name?.trim()) return s.name.trim()
  const parts = [s.first_name, s.last_name].filter((p) => p?.trim())
  if (parts.length) return parts.join(" ").trim()
  return "—"
}

export default function AdminStudentsPage() {
  const t = useTranslations("AdminStudents")
  const locale = useLocale()
  const [students, setStudents] = useState<StudentListItem[] | null>(null)

  const load = useCallback(async () => {
    const list = await apiClientJson<StudentListItem[]>("/users/students")
    setStudents(list)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await load()
      } catch {
        if (!cancelled) setStudents([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  if (!students) {
    return (
      <div className="flex min-h-[320px] items-center justify-center p-8">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const dateLocale = locale === "kz" ? "kk-KZ" : "ru-RU"

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
          {students && students.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colName")}</TableHead>
                  <TableHead>{t("colEmail")}</TableHead>
                  <TableHead>{t("colSchool")}</TableHead>
                  <TableHead>{t("colClass")}</TableHead>
                  <TableHead>{t("colProfile")}</TableHead>
                  <TableHead className="text-right">{t("colJoined")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{displayName(s)}</TableCell>
                    <TableCell className="text-muted-foreground">{s.phone ?? s.email}</TableCell>
                    <TableCell>{s.school_name?.trim() || "—"}</TableCell>
                    <TableCell>{s.school_class?.trim() || "—"}</TableCell>
                    <TableCell>
                      {s.ent_profile ? <Badge variant="secondary">{s.ent_profile}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {new Date(s.created_at).toLocaleString(dateLocale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
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
