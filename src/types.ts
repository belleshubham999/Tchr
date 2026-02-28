export interface User {
  id: string;
  email: string;
  full_name?: string;
  email_verified?: boolean;
  avatar_url?: string;
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  summary: string;
  tags: string;
  created_at: string;
}

export interface Flashcard {
  id: string;
  user_id: string;
  note_id: string | null;
  title?: string;
  question: string;
  answer: string;
  last_reviewed: string | null;
  next_review: string | null;
  ease_factor: number;
  interval: number;
  repetition: number;
  created_at: string;
}

export interface StudyPlan {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface StudyGroup {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  member_count?: number;
}

export interface ProgressStats {
  today: {
    cards_reviewed: number;
    notes_created: number;
  };
  history: {
    date: string;
    cards_reviewed: number;
    notes_created: number;
  }[];
  totalNotes: number;
  totalCards: number;
}

export interface ExamQuestion {
  id: string;
  type: 'mcq' | 'fillup' | 'match' | 'qa';
  question: string;
  marks: number;
  options?: string[];
  pairs?: { left: string; right: string }[];
  leftItems?: string[];
  rightItems?: string[];
  correctMatches?: { [key: string]: string };
  correctAnswer: string;
  keywords?: string[];
}

export interface Exam {
  id: string;
  user_id: string;
  title: string;
  grade_level: string;
  subject: string;
  lesson_name: string;
  total_marks: number;
  instructions?: string;
  questions: ExamQuestion[];
  answers: { [key: string]: string };
  created_at: string;
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  user_id: string;
  user_answers: { [key: string]: string };
  marks_obtained: number;
  total_marks: number;
  submitted_at: string;
}
