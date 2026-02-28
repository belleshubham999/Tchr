import { supabase } from './supabase';
import { Note, Flashcard, StudyPlan, StudyGroup, ProgressStats, Exam, ExamAttempt } from '../types';

// NOTES
export const fetchNotes = async (userId: string): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const createNote = async (userId: string, title: string, content: string, summary: string, tags: string): Promise<string> => {
  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      title,
      content,
      summary,
      tags
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data?.id || '';
};

export const updateNote = async (userId: string, noteId: string, title: string, content: string, summary: string, tags: string): Promise<void> => {
  const { error } = await supabase
    .from('notes')
    .update({ title, content, summary, tags })
    .eq('id', noteId)
    .eq('user_id', userId);
  
  if (error) throw error;
};

export const deleteNote = async (userId: string, noteId: string): Promise<void> => {
  // Delete associated flashcards first
  await supabase
    .from('flashcards')
    .delete()
    .eq('note_id', noteId)
    .eq('user_id', userId);
  
  // Delete the note
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', userId);
  
  if (error) throw error;
};

// FLASHCARDS
export const fetchFlashcards = async (userId: string): Promise<Flashcard[]> => {
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const fetchDueFlashcards = async (userId: string): Promise<Flashcard[]> => {
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('user_id', userId)
    .or(`next_review.is.null,next_review.lte.${new Date().toISOString()}`)
    .order('next_review', { ascending: true });
  
  if (error) throw error;
  return data || [];
};

export const fetchNoteFlashcards = async (userId: string, noteId: string): Promise<Flashcard[]> => {
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('user_id', userId)
    .eq('note_id', noteId);
  
  if (error) throw error;
  return data || [];
};

export const fetchStandaloneFlashcards = async (userId: string): Promise<Flashcard[]> => {
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('user_id', userId)
    .is('note_id', null)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const createFlashcard = async (userId: string, question: string, answer: string, noteId?: string | null, title?: string): Promise<string> => {
  const { data, error } = await supabase
    .from('flashcards')
    .insert({
      user_id: userId,
      note_id: noteId || null,
      question,
      answer,
      title: title || null,
      next_review: null,
      last_reviewed: null,
      ease_factor: 2.5,
      interval: 0,
      repetition: 0
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data?.id || '';
};

export const updateFlashcard = async (userId: string, cardId: string, question: string, answer: string): Promise<void> => {
  const { error } = await supabase
    .from('flashcards')
    .update({ question, answer })
    .eq('id', cardId)
    .eq('user_id', userId);
  
  if (error) throw error;
};

export const deleteFlashcard = async (userId: string, cardId: string): Promise<void> => {
  const { error } = await supabase
    .from('flashcards')
    .delete()
    .eq('id', cardId)
    .eq('user_id', userId);
  
  if (error) throw error;
};

export const reviewFlashcard = async (userId: string, cardId: string, quality: number): Promise<void> => {
  const now = new Date();
  const nextReview = new Date(now.getTime() + quality * 24 * 60 * 60 * 1000); // quality days

  const { error } = await supabase
    .from('flashcards')
    .update({
      last_reviewed: now.toISOString(),
      next_review: nextReview.toISOString()
    })
    .eq('id', cardId)
    .eq('user_id', userId);
  
  if (error) throw error;

  // Update progress
  await updateProgress(userId);
};

// STUDY PLANS
export const fetchStudyPlans = async (userId: string): Promise<StudyPlan[]> => {
  const { data, error } = await supabase
    .from('study_plans')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const createStudyPlan = async (userId: string, title: string, content: string): Promise<string> => {
  const { data, error } = await supabase
    .from('study_plans')
    .insert({
      user_id: userId,
      title,
      content
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data?.id || '';
};

export const updateStudyPlan = async (userId: string, planId: string, title: string, content: string): Promise<void> => {
  const { error } = await supabase
    .from('study_plans')
    .update({ title, content })
    .eq('id', planId)
    .eq('user_id', userId);
  
  if (error) throw error;
};

export const deleteStudyPlan = async (userId: string, planId: string): Promise<void> => {
  const { error } = await supabase
    .from('study_plans')
    .delete()
    .eq('id', planId)
    .eq('user_id', userId);
  
  if (error) throw error;
};

// STUDY GROUPS
export const fetchStudyGroups = async (): Promise<StudyGroup[]> => {
  const { data, error } = await supabase
    .from('study_groups')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const createStudyGroup = async (userId: string, name: string, description: string): Promise<string> => {
  const { data, error } = await supabase
    .from('study_groups')
    .insert({
      name,
      description,
      created_by: userId
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data?.id || '';
};

export const deleteStudyGroup = async (userId: string, groupId: string): Promise<void> => {
  const { error } = await supabase
    .from('study_groups')
    .delete()
    .eq('id', groupId)
    .eq('created_by', userId);
  
  if (error) throw error;
};

// PROGRESS
export const fetchProgressStats = async (userId: string): Promise<ProgressStats> => {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: todayData } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  const { data: historyData } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(7);

  const { data: notesCount } = await supabase
    .from('notes')
    .select('id', { count: 'exact' })
    .eq('user_id', userId);

  const { data: cardsCount } = await supabase
    .from('flashcards')
    .select('id', { count: 'exact' })
    .eq('user_id', userId);

  return {
    today: todayData || { cards_reviewed: 0, notes_created: 0 },
    history: historyData || [],
    totalNotes: notesCount?.length || 0,
    totalCards: cardsCount?.length || 0
  };
};

export const updateProgress = async (userId: string): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: existing } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('progress')
      .update({ cards_reviewed: (existing.cards_reviewed || 0) + 1 })
      .eq('user_id', userId)
      .eq('date', today);
  } else {
    await supabase
      .from('progress')
      .insert({
        user_id: userId,
        date: today,
        cards_reviewed: 1,
        notes_created: 0
      });
  }
};

export const updateProgressNoteCreated = async (userId: string): Promise<void> => {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: existing } = await supabase
    .from('progress')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('progress')
      .update({ notes_created: (existing.notes_created || 0) + 1 })
      .eq('user_id', userId)
      .eq('date', today);
  } else {
    await supabase
      .from('progress')
      .insert({
        user_id: userId,
        date: today,
        cards_reviewed: 0,
        notes_created: 1
      });
  }
};

// EXAMS
export const createExam = async (userId: string, exam: Exam): Promise<string> => {
  const { data, error } = await supabase
    .from('exams')
    .insert({
      user_id: userId,
      title: exam.title,
      grade_level: exam.grade_level,
      subject: exam.subject,
      lesson_name: exam.lesson_name,
      total_marks: exam.total_marks,
      instructions: exam.instructions,
      questions: exam.questions,
      answers: exam.answers
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data?.id || '';
};

export const fetchExams = async (userId: string): Promise<Exam[]> => {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const fetchExam = async (userId: string, examId: string): Promise<Exam> => {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .eq('user_id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteExam = async (userId: string, examId: string): Promise<void> => {
  const { error } = await supabase
    .from('exams')
    .delete()
    .eq('id', examId)
    .eq('user_id', userId);
  
  if (error) throw error;
};

export const submitExamAttempt = async (attempt: ExamAttempt): Promise<string> => {
  const { data, error } = await supabase
    .from('exam_attempts')
    .insert({
      exam_id: attempt.exam_id,
      user_id: attempt.user_id,
      user_answers: attempt.user_answers,
      marks_obtained: attempt.marks_obtained,
      total_marks: attempt.total_marks
    })
    .select('id')
    .single();
  
  if (error) throw error;
  return data?.id || '';
};

export const fetchExamAttempts = async (userId: string, examId: string): Promise<ExamAttempt[]> => {
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('*')
    .eq('user_id', userId)
    .eq('exam_id', examId)
    .order('submitted_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
};

export const fetchExamAttempt = async (userId: string, attemptId: string): Promise<ExamAttempt> => {
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('*')
    .eq('id', attemptId)
    .eq('user_id', userId)
    .single();
  
  if (error) throw error;
  return data;
};
