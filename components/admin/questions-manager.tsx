"use client"

import { useMemo, useState } from "react"
import { Link } from "@/i18n/navigation"
import { apiClientJson } from "@/lib/client-api"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FileUp, Plus, Pencil, Trash2 } from "lucide-react"
import { normalizeQuestionDifficulty } from "@/lib/question-difficulty"
import {
  normalizeQuestionLanguage,
  QUESTION_LANGUAGE_OPTIONS,
  questionLanguageLabel,
} from "@/lib/question-languages"
import type { Question, Subject } from "@/lib/types"

interface QuestionsManagerProps {
  initialQuestions: (Question & { subjects: Subject | null })[]
  subjects: Subject[]
}

export function QuestionsManager({ initialQuestions, subjects }: QuestionsManagerProps) {
  const [questions, setQuestions] = useState(initialQuestions)
  const [filterSubject, setFilterSubject] = useState<string>("all")
  const [filterLanguage, setFilterLanguage] = useState<string>("all")

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (filterSubject !== "all" && q.subject_id !== filterSubject) return false
      if (filterLanguage !== "all") {
        const lang = normalizeQuestionLanguage(q.language)
        if (lang !== filterLanguage) return false
      }
      return true
    })
  }, [questions, filterSubject, filterLanguage])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return

    await apiClientJson(`/questions/${id}`, { method: "DELETE" })
    setQuestions(questions.filter((q) => q.id !== id))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>All Questions</CardTitle>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={filterSubject} onValueChange={setFilterSubject}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((subject) => (
                <SelectItem key={subject.id} value={subject.id}>
                  {subject.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterLanguage} onValueChange={setFilterLanguage}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              {QUESTION_LANGUAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {subjects.length === 0 ? (
            <Button disabled title="Create at least one subject first">
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
          ) : (
            <>
              <Button variant="outline" asChild>
                <Link href="/admin/questions/import">
                  <FileUp className="mr-2 h-4 w-4" />
                  Import from PDF
                </Link>
              </Button>
              <Button asChild>
                <Link href="/admin/questions/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Question
                </Link>
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filteredQuestions.length > 0 ? (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[48%] min-w-0">Question</TableHead>
                <TableHead className="min-w-0">Subject</TableHead>
                <TableHead className="w-24">Language</TableHead>
                <TableHead className="w-16">Level</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="w-14">Points</TableHead>
                <TableHead className="w-28 shrink-0 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuestions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell className="max-w-0 min-w-0 font-medium whitespace-normal">
                    <div className="truncate" title={question.question_text}>
                      {question.question_text}
                    </div>
                  </TableCell>
                  <TableCell>
                    {question.subjects?.name ? (
                      <Badge variant="secondary">{question.subjects.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {questionLanguageLabel(normalizeQuestionLanguage(question.language))}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{normalizeQuestionDifficulty(question.difficulty)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {question.question_type === "single_choice"
                        ? "Single"
                        : question.question_type === "match"
                          ? "Match"
                          : "Multiple"}
                    </Badge>
                  </TableCell>
                  <TableCell>{question.points}</TableCell>
                  <TableCell className="w-28 shrink-0 text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/admin/questions/${question.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(question.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="py-8 text-center text-muted-foreground">
            {questions.length === 0
              ? "No questions yet. Add your first question to get started."
              : "No questions match the current filters."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
