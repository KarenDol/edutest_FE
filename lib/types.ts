export type UserRole = 'admin' | 'student'

export interface Profile {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface StudentListItem {
  id: string
  email: string | null
  phone: string | null
  name: string | null
  first_name: string | null
  last_name: string | null
  school_name: string | null
  school_class: string | null
  ent_profile: string | null
  created_at: string
}

export interface Subject {
  id: string
  name: string
  created_at: string
}

export type QuestionLanguage = "kazakh" | "russian" | "english"
export type QuestionDifficulty = "A" | "B" | "C"

export interface QuestionMathPayload {
  stem_latex: string
  options_latex: string[]
  image_urls: string[]
}

export type MatchQuestionOptions = {
  left: string[]
  right: string[]
}

export interface Question {
  id: string
  subject_id: string | null
  question_text: string
  question_type: 'single_choice' | 'multiple_choice' | 'match'
  options: string[] | MatchQuestionOptions
  correct_answers: string[] | number[]
  points: number
  language?: QuestionLanguage
  difficulty?: QuestionDifficulty
  created_by: string | null
  created_at: string
  updated_at: string
  subject?: Subject
  math?: QuestionMathPayload | null
}

export interface SubjectPick {
  subject_id: string
  question_count: number
}

export interface TestSection {
  id: string
  test_id: string
  name: string
  duration_minutes: number
  section_order: number
  subject_picks: SubjectPick[]
}

export interface TestSectionInput {
  name: string
  duration_minutes: number
  subject_picks: SubjectPick[]
  question_ids?: string[]
}

export interface Test {
  id: string
  title: string
  description: string | null
  subject_id: string | null
  duration_minutes: number | null
  is_active: boolean
  shuffle_answer_options?: boolean
  show_calculator?: boolean
  show_periodic_table?: boolean
  /** 0 = off, 1 = camera+screen, 3 = camera+screen+face AI */
  proctoring_version?: number
  created_by: string | null
  created_at: string
  updated_at: string
  subject?: Subject
  questions?: Question[]
  question_count?: number
  test_sections?: TestSection[]
}

export interface TestQuestion {
  id: string
  test_id: string
  section_id?: string | null
  question_id: string
  question_order: number
  question?: Question
}

export type QuestionReportReason =
  | 'no_correct_option'
  | 'mistake_in_question'
  | 'wrong_correct_answer'
  | 'unclear_wording'
  | 'other'

export interface QuestionReport {
  id: string
  submission_id: string
  question_id: string
  reason: QuestionReportReason
  comment: string | null
  created_at: string
}

export interface QuestionReportAdmin extends QuestionReport {
  reporter?: { name: string | null; email: string | null; phone?: string | null }
  test?: { id: string; title: string } | null
  question_preview?: string | null
}

export interface Submission {
  id: string
  student_id: string
  test_id: string
  answers: Record<string, string[]>
  total_score: number
  max_score: number
  percentage: number
  started_at: string
  submitted_at: string | null
  question_reports?: QuestionReport[]
  test?: Test
  student?: Profile
}
