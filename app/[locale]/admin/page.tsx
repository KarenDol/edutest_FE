"use client"

import { useEffect, useState } from "react"
import { apiClientJson } from "@/lib/client-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, FileQuestion, ClipboardList, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

type AdminDashboard = {
  subjects_count: number
  questions_count: number
  tests_count: number
  students_count: number
  recent_submissions: {
    id: string
    percentage: number
    submitted_at: string | null
    profiles: { name: string | null; email: string | null; phone?: string | null }
    tests: { title: string | null }
  }[]
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await apiClientJson<AdminDashboard>("/stats/admin-dashboard")
        if (!cancelled) setData(d)
      } catch {
        if (!cancelled) setData(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!data) {
    return (
      <div className="flex min-h-[320px] items-center justify-center p-8">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  const stats = [
    { label: "Total Subjects", value: data.subjects_count, icon: BookOpen, color: "text-primary" },
    { label: "Total Questions", value: data.questions_count, icon: FileQuestion, color: "text-accent" },
    { label: "Total Tests", value: data.tests_count, icon: ClipboardList, color: "text-chart-3" },
    { label: "Total Students", value: data.students_count, icon: Users, color: "text-chart-4" },
  ]

  const recentSubmissions = data.recent_submissions

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome to the admin dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSubmissions && recentSubmissions.length > 0 ? (
            <div className="space-y-4">
              {recentSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{submission.profiles?.name || "Unknown Student"}</p>
                    <p className="text-sm text-muted-foreground">
                      {submission.tests?.title || "Unknown Test"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-lg">{submission.percentage?.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">
                      {submission.submitted_at
                        ? new Date(submission.submitted_at).toLocaleDateString()
                        : "In Progress"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No submissions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
