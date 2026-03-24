export type UserRole = "student" | "instructor" | "admin" | "associado";

export type CourseStatus = "draft" | "published" | "archived";

export type VideoSource = "youtube" | "google_drive" | "other";

export type CourseType = "async" | "sync";

export type EnrollmentStatus = "active" | "completed" | "cancelled";

export type PaymentStatus = "free" | "pending" | "paid" | "refunded";

export type InstructorRole = "lead" | "assistant";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  long_description: string | null;
  thumbnail_url: string | null;
  instructor_id: string;
  is_free: boolean;
  price_cents: number | null;
  status: CourseStatus;
  category: string | null;
  total_duration_minutes: number | null;
  certificate_enabled: boolean;
  certificate_hours: number | null;
  certificate_body_text: string | null;
  default_lesson_thumbnail_url: string | null;
  exam_enabled: boolean;
  exam_passing_score: number;
  whatsapp_number: string | null;
  learning_points: string[] | null;
  course_type: CourseType;
  featured?: boolean;
  featured_label?: string | null;
  price?: number | null;
  created_at: string;
  updated_at: string;
  // Relations
  instructor?: Profile;
  sections?: Section[];
  enrollments_count?: number;
  average_rating?: number;
  reviews_count?: number;
}

export interface Section {
  id: string;
  course_id: string;
  title: string;
  position: number;
  created_at: string;
  // Relations
  lessons?: Lesson[];
}

export interface Lesson {
  id: string;
  section_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_source: VideoSource | null;
  duration_minutes: number | null;
  thumbnail_url: string | null;
  position: number;
  is_preview: boolean;
  created_at: string;
  // Relations
  attachments?: LessonAttachment[];
  progress?: LessonProgress | null;
}

export interface LessonAttachment {
  id: string;
  lesson_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size_bytes: number | null;
  position: number;
  created_at: string;
}

export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  completed_at: string | null;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  // Relations
  course?: Course;
  user?: Profile;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  completed_at: string | null;
}

export interface ExamQuestion {
  id: string;
  course_id: string;
  question_text: string;
  options: ExamOption[];
  position: number;
  created_at: string;
}

export interface ExamOption {
  id: string;
  text: string;
  is_correct: boolean;
}

export interface ExamAttempt {
  id: string;
  user_id: string;
  course_id: string;
  score: number;
  passed: boolean;
  answers: ExamAnswer[];
  attempted_at: string;
}

export interface ExamAnswer {
  question_id: string;
  selected_option_id: string;
  correct: boolean;
}

export interface Certificate {
  id: string;
  user_id: string;
  course_id: string;
  certificate_code: string;
  issued_at: string;
  pdf_url: string | null;
  // Relations
  user?: Profile;
  course?: Course;
}

export interface Review {
  id: string;
  user_id: string;
  course_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  user?: Profile;
}

export interface LessonComment {
  id: string;
  lesson_id: string;
  user_id: string;
  content: string;
  created_at: string;
  // Relations
  user?: Profile;
}

export interface CourseInstructor {
  course_id: string;
  instructor_id: string;
  role: InstructorRole;
  added_at: string;
  // Relations
  instructor?: Profile;
}
