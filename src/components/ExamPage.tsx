import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { Exam, ExamAttempt, ExamQuestion } from '../types';
import * as db from '../lib/db';
import { tutorChat } from '../services/sarvam';

interface ExamPageProps {
    user: { id: string };
}

const SUBJECTS = [
    'Mathematics',
    'Science',
    'English',
    'History',
    'Geography',
    'Biology',
    'Chemistry',
    'Physics',
    'Computer Science',
    'Social Studies'
];

const GRADE_LEVELS = ['Class 1-5', 'Class 6-8', 'Class 9-10', 'Class 11-12', 'College'];

export default function ExamPage({ user }: ExamPageProps) {
    const [stage, setStage] = useState<'list' | 'create' | 'take' | 'report'>('list');
    const [exams, setExams] = useState<Exam[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Create exam form
    const [gradeLevel, setGradeLevel] = useState('');
    const [subject, setSubject] = useState('');
    const [lessonName, setLessonName] = useState('');
    const [totalMarks, setTotalMarks] = useState(100);
    const [instructions, setInstructions] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Take exam
    const [currentExam, setCurrentExam] = useState<Exam | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [userAnswers, setUserAnswers] = useState<{ [key: string]: string }>({});

    // Report
    const [currentAttempt, setCurrentAttempt] = useState<ExamAttempt & { exam: Exam } | null>(null);
    const [practiceDiagrams, setPracticeDiagrams] = useState<string[]>([]);
    const [showDiagrams, setShowDiagrams] = useState(false);
    const [questionEvaluations, setQuestionEvaluations] = useState<{ [key: string]: { marks_obtained: number; feedback: string } }>({});

    useEffect(() => {
        fetchExams();
    }, []);

    const fetchExams = async () => {
        try {
            const data = await db.fetchExams(user.id);
            setExams(data);
        } catch (error) {
            console.error('Failed to fetch exams:', error);
        }
    };

    const generateExam = async () => {
        if (!gradeLevel || !subject || !lessonName || !totalMarks) {
            alert('Please fill all fields');
            return;
        }

        setIsGenerating(true);
        try {
            const prompt = `You must respond with ONLY a JSON object. No other text.

    Generate an exam question paper for:
    - Grade Level: ${gradeLevel}
    - Subject: ${subject}
    - Lesson: ${lessonName}
    - Total Marks: ${totalMarks}

    Instructions from user: ${instructions || 'Mix of easy, medium and hard questions. Include various question types.'}

    CRITICAL RULES: 
    1. Respond in English ONLY. Do not use any other language.
    2. DO NOT include any diagram-based or image-based questions. Only text-based questions.
    3. ALL JSON keys, labels, and content must be in English ONLY.
    4. Return ONLY the JSON object. No markdown, no explanations, no extra text.

    Generate questions with the following types: MCQ, Fill in the blanks, Match the following, Short Answer.
    Distribute marks properly so they add up to exactly ${totalMarks} marks.

    For "match" type: Create pairs that need to be matched (left column with right column).
    Example: left items are concepts, right items are definitions. User will select correct matches.

    JSON Structure:
    {
    "questions": [
    {
      "id": "q1",
      "type": "mcq|fillup|match|qa",
      "question": "question text",
      "marks": number,
      "options": ["option a", "option b", "option c", "option d"],
      "leftItems": ["item1", "item2", "item3"],
      "rightItems": ["definition1", "definition2", "definition3"],
      "correctMatches": {"item1": "definition1", "item2": "definition2"},
      "correctAnswer": "answer text or option letter"
    }
    ]
    }`;

            const response = await tutorChat([], prompt);
            console.log('Raw exam response:', response);

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('Failed to extract JSON from response:', response);
                throw new Error('Invalid response format - no JSON found');
            }

            let examData;
            try {
                examData = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                console.error('Failed to parse JSON:', jsonMatch[0], parseError);
                throw new Error('Invalid JSON format');
            }

            if (!examData.questions || !Array.isArray(examData.questions)) {
                console.error('Missing or invalid questions array:', examData);
                throw new Error('No valid questions in response');
            }

            const newExam: Exam = {
                id: '',
                user_id: user.id,
                title: `${subject} - ${lessonName}`,
                grade_level: gradeLevel,
                subject,
                lesson_name: lessonName,
                total_marks: totalMarks,
                instructions,
                questions: examData.questions,
                answers: examData.questions.reduce((acc: any, q: any) => {
                    acc[q.id] = q.correctAnswer || q.correctMatches;
                    return acc;
                }, {}),
                created_at: new Date().toISOString()
            };

            const examId = await db.createExam(user.id, newExam);
            newExam.id = examId;

            setExams([newExam, ...exams]);
            setStage('list');
            setGradeLevel('');
            setSubject('');
            setLessonName('');
            setTotalMarks(100);
            setInstructions('');
        } catch (error) {
            console.error('Failed to generate exam:', error);
            alert('Failed to generate exam. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const startExam = (exam: Exam) => {
        setCurrentExam(exam);
        setCurrentQuestion(0);
        setUserAnswers({});
        setStage('take');
    };

    const handleAnswerChange = (questionId: string, answer: string) => {
        setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const submitExam = async () => {
        if (!currentExam) return;

        try {
            setIsGenerating(true);

            // Build user answers string, handling different question types
            const answersText = currentExam.questions.map((q, idx) => {
                let userAnswer = userAnswers[q.id];
                let formattedUserAnswer = userAnswer;
                let formattedCorrectAnswer = JSON.stringify(currentExam.answers[q.id]);

                // For match questions, format answers clearly for AI
                if (q.type === 'match' && q.rightItems) {
                    // Build readable user answer
                    const userMatches: string[] = [];
                    q.rightItems.forEach((rightItem, idx) => {
                        const matchKey = `${q.id}-match-${idx}`;
                        if (userAnswers[matchKey]) {
                            const leftItemIndex = userAnswers[matchKey].charCodeAt(0) - 97;
                            const leftItem = q.leftItems?.[leftItemIndex];
                            userMatches.push(`${rightItem} → ${userAnswers[matchKey]} (${leftItem})`);
                        } else {
                            userMatches.push(`${rightItem} → (No match)`);
                        }
                    });
                    formattedUserAnswer = userMatches.join('; ');

                    // Build readable correct answer
                    const correctMatches = currentExam.answers[q.id];
                    if (typeof correctMatches === 'object' && !Array.isArray(correctMatches)) {
                        const correctMatchTexts: string[] = [];
                        q.rightItems?.forEach((rightItem, idx) => {
                            const correctLetter = correctMatches[idx];
                            if (correctLetter) {
                                const leftItemIndex = correctLetter.charCodeAt(0) - 97;
                                const leftItem = q.leftItems?.[leftItemIndex];
                                correctMatchTexts.push(`${rightItem} → ${correctLetter} (${leftItem})`);
                            }
                        });
                        formattedCorrectAnswer = correctMatchTexts.join('; ');
                    }
                }

                return `
            Question ${idx + 1} (${q.marks} marks): ${q.question}
            Type: ${q.type}
            ${q.options ? `Options: ${q.options.join(', ')}` : ''}
            ${q.leftItems ? `Left items (A, B, C...): ${q.leftItems.map((item, i) => `${String.fromCharCode(97 + i)}) ${item}`).join('; ')}` : ''}
            ${q.rightItems ? `Right items (1, 2, 3...): ${q.rightItems.map((item, i) => `${i + 1}) ${item}`).join('; ')}` : ''}
            Correct Answer: ${formattedCorrectAnswer}
            User's Answer: ${formattedUserAnswer || '(No answer)'}
            `;
            }).join('\n');

            // Send all answers to AI for evaluation
            const evaluationPrompt = `You are an exam evaluator. Check the following exam answers STRICTLY. Respond with ONLY a JSON object. No other text.

            Exam: ${currentExam.title}
            Total Marks: ${currentExam.total_marks}

            Questions and User Answers:
            ${answersText}

            Evaluation Rules:
            - For MCQ: Compare user's letter answer (a, b, c, d) with correct answer. Only full marks if exactly correct, 0 otherwise.
            - For Fill-ups: Only full marks if exactly correct, 0 otherwise.
            - For Match: Only full marks if all matches are correct, otherwise partial based on correct matches.
            - For Q&A: Award marks based on how well the answer addresses the question (partial marks allowed).

      CRITICAL: 
      1. Respond in English ONLY. 
      2. Return ONLY the JSON object. No markdown, no explanations, no extra text.
      3. All JSON keys and values must be in English ONLY.

      JSON Structure:
      {
      "evaluations": [
      {
      "question_id": "q1",
      "marks_obtained": number,
      "feedback": "brief feedback"
      }
      ],
      "total_marks_obtained": number
      }`;

            const response = await tutorChat([], evaluationPrompt);

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('Evaluation response was:', response);
                throw new Error('Could not evaluate exam');
            }

            const evaluation = JSON.parse(jsonMatch[0]);
            const marksObtained = evaluation.total_marks_obtained || 0;

            const attempt: ExamAttempt = {
                id: '',
                exam_id: currentExam.id,
                user_id: user.id,
                user_answers: userAnswers,
                marks_obtained: marksObtained,
                total_marks: currentExam.total_marks,
                submitted_at: new Date().toISOString()
            };

            await db.submitExamAttempt(attempt);
            setCurrentAttempt({ ...attempt, exam: currentExam });
            
            // Store evaluations for displaying question-by-question results
            const evaluationMap: { [key: string]: { marks_obtained: number; feedback: string } } = {};
            (evaluation.evaluations || []).forEach((evalItem: any) => {
                evaluationMap[evalItem.question_id] = {
                    marks_obtained: evalItem.marks_obtained || 0,
                    feedback: evalItem.feedback || ''
                };
            });
            setQuestionEvaluations(evaluationMap);
            
            setStage('report');
        } catch (error) {
            console.error('Failed to submit exam:', error);
            alert('Failed to evaluate exam. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const generatePracticeDiagrams = async () => {
        if (!currentAttempt) return;

        try {
            setIsGenerating(true);
            const diagramPrompt = `You must respond with ONLY a JSON object. No other text.

      For the following exam, provide a simple list of diagrams/visual topics that the student should practice to master this subject.

      Exam: ${currentAttempt.exam.title}
      Grade Level: ${currentAttempt.exam.grade_level}
      Subject: ${currentAttempt.exam.subject}
      Lesson: ${currentAttempt.exam.lesson_name}

      CRITICAL:
      1. Respond in English ONLY.
      2. Return ONLY the JSON object. No markdown, no explanations, no extra text.
      3. All JSON keys and values must be in English ONLY.

      JSON Structure:
      {
      "topics": [
      "Topic/Diagram 1",
      "Topic/Diagram 2",
      "Topic/Diagram 3"
      ]
      }

      Just provide headings of diagrams they should practice. Be concise and specific.`;

            const response = await tutorChat([], diagramPrompt);

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('Diagram response was:', response);
                throw new Error('Could not parse response');
            }

            const data = JSON.parse(jsonMatch[0]);
            setPracticeDiagrams(data.topics || []);
            setShowDiagrams(true);
        } catch (error) {
            console.error('Failed to generate diagrams:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const goBack = () => {
        setStage('list');
        setCurrentExam(null);
        setCurrentAttempt(null);
        setCurrentQuestion(0);
        setUserAnswers({});
        setPracticeDiagrams([]);
        setShowDiagrams(false);
    };

    if (stage === 'list') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-5xl mx-auto"
            >
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold">Exams</h2>
                    <button
                        onClick={() => setStage('create')}
                        className="bg-black text-white px-6 py-3 rounded-xl font-semibold hover:bg-zinc-800 transition-colors"
                    >
                        + Create Exam
                    </button>
                </div>

                {exams.length === 0 ? (
                    <div className="bg-white border border-zinc-100 rounded-2xl p-12 text-center">
                        <p className="text-zinc-500 mb-4">No exams yet. Create one to get started!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {exams.map(exam => (
                            <div key={exam.id} className="bg-white border border-zinc-100 rounded-2xl p-6 hover:shadow-lg transition-all">
                                <h3 className="text-lg font-bold mb-2">{exam.title}</h3>
                                <p className="text-sm text-zinc-500 mb-4">{exam.grade_level} • {exam.subject}</p>
                                <p className="text-2xl font-bold text-black mb-6">{exam.total_marks} Marks</p>
                                <button
                                    onClick={() => startExam(exam)}
                                    className="w-full bg-black text-white py-2 rounded-lg font-semibold hover:bg-zinc-800 transition-colors"
                                >
                                    Take Exam
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>
        );
    }

    if (stage === 'create') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto"
            >
                <div className="bg-white border border-zinc-100 rounded-2xl p-8">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-3xl font-bold">Create Exam</h2>
                        <button
                            onClick={() => setStage('list')}
                            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2">Grade Level</label>
                            <select
                                value={gradeLevel}
                                onChange={(e) => setGradeLevel(e.target.value)}
                                className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                            >
                                <option value="">Select Grade Level</option>
                                {GRADE_LEVELS.map(level => (
                                    <option key={level} value={level}>{level}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2">Subject</label>
                            <select
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                            >
                                <option value="">Select Subject</option>
                                {SUBJECTS.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2">Lesson Name</label>
                            <input
                                type="text"
                                value={lessonName}
                                onChange={(e) => setLessonName(e.target.value)}
                                placeholder="e.g., Quadratic Equations"
                                className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2">Total Marks</label>
                            <input
                                type="number"
                                value={totalMarks}
                                onChange={(e) => setTotalMarks(parseInt(e.target.value) || 0)}
                                min="10"
                                max="500"
                                className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2">Instructions (Optional)</label>
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                placeholder="e.g., Only MCQs, Mix of easy and hard, Focus on concepts..."
                                rows={4}
                                className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 resize-none"
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => setStage('list')}
                                className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-semibold hover:bg-zinc-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={generateExam}
                                disabled={isGenerating}
                                className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isGenerating && <Loader2 size={18} className="animate-spin" />}
                                {isGenerating ? 'Generating...' : 'Generate Exam'}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    if (stage === 'take' && currentExam) {
        const question = currentExam.questions[currentQuestion];
        const progress = Math.round(((currentQuestion + 1) / currentExam.questions.length) * 100);

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
            >
                <div className="bg-white border border-zinc-100 rounded-2xl p-8">
                    {/* Progress Bar */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-semibold text-zinc-700">
                                Question {currentQuestion + 1} of {currentExam.questions.length}
                            </span>
                            <span className="text-sm font-semibold text-zinc-700">{progress}%</span>
                        </div>
                        <div className="w-full bg-zinc-200 rounded-full h-2">
                            <div
                                className="bg-black h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Question */}
                    <div className="mb-8">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-2xl font-bold flex-1">{question.question}</h3>
                            <span className="text-lg font-bold text-black ml-4">{question.marks} Marks</span>
                        </div>

                        {/* Answer Input */}
                        <div className="mt-6">
                            {question.type === 'mcq' && (
                                <div className="space-y-3">
                                    {question.options?.map((option, idx) => {
                                        const optionLetter = String.fromCharCode(97 + idx); // 'a', 'b', 'c', 'd'
                                        return (
                                            <label key={idx} className="flex items-center p-4 border border-zinc-200 rounded-xl cursor-pointer hover:bg-zinc-50 transition-colors">
                                                <input
                                                    type="radio"
                                                    name={question.id}
                                                    value={optionLetter}
                                                    checked={userAnswers[question.id] === optionLetter}
                                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                                    className="w-4 h-4"
                                                />
                                                <span className="ml-3 font-medium">{option}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}

                            {question.type === 'fillup' && (
                                <input
                                    type="text"
                                    value={userAnswers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    placeholder="Type your answer here..."
                                    className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                                />
                            )}

                            {question.type === 'match' && (
                                <div className="space-y-4">
                                    <p className="text-sm text-zinc-600 mb-6">Select which item from Column A matches each item in Column B</p>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="font-bold mb-4 text-center text-sm bg-blue-100 py-2 rounded">Column A - Items</h4>
                                            <div className="space-y-2">
                                                {question.leftItems?.map((item, idx) => (
                                                    <div key={idx} className="p-3 bg-blue-50 border-2 border-blue-300 rounded-lg font-medium text-blue-900">
                                                        <span className="font-bold text-lg">{String.fromCharCode(97 + idx)}</span>. {item}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-bold mb-4 text-center text-sm bg-green-100 py-2 rounded">Column B - Definitions</h4>
                                            <div className="space-y-2">
                                                {question.rightItems?.map((item, idx) => (
                                                    <div key={idx} className="flex items-start gap-3">
                                                        <div className="flex-1 p-3 bg-green-50 border-2 border-green-300 rounded-lg text-green-900">
                                                            <p className="font-medium mb-2">{idx + 1}. {item}</p>
                                                            <select
                                                                value={userAnswers[`${question.id}-match-${idx}`] || ''}
                                                                onChange={(e) => handleAnswerChange(`${question.id}-match-${idx}`, e.target.value)}
                                                                className="w-full px-2 py-2 border border-green-400 rounded bg-white text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                                                            >
                                                                <option value="">Select...</option>
                                                                {question.leftItems?.map((leftItem, leftIdx) => {
                                                                    const leftLetter = String.fromCharCode(97 + leftIdx);
                                                                    return (
                                                                        <option key={leftIdx} value={leftLetter}>
                                                                            {leftLetter}. {leftItem}
                                                                        </option>
                                                                    );
                                                                })}
                                                            </select>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {question.type === 'qa' && (
                                <textarea
                                    value={userAnswers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    placeholder="Write your answer here..."
                                    rows={6}
                                    className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 resize-none"
                                />
                            )}
                        </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex gap-3 pt-8 border-t border-zinc-100">
                        <button
                            onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                            disabled={currentQuestion === 0}
                            className="px-6 py-3 border border-zinc-200 rounded-xl font-semibold hover:bg-zinc-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            <ChevronLeft size={18} />
                            Previous
                        </button>

                        <div className="flex-1" />

                        {currentQuestion === currentExam.questions.length - 1 ? (
                            <button
                                onClick={submitExam}
                                disabled={isGenerating}
                                className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isGenerating && <Loader2 size={18} className="animate-spin" />}
                                {isGenerating ? 'Evaluating...' : 'Submit Exam'}
                            </button>
                        ) : (
                            <button
                                onClick={() => setCurrentQuestion(prev => prev + 1)}
                                className="px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-colors flex items-center gap-2"
                            >
                                Next
                                <ChevronRight size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    }

    if (stage === 'report' && currentAttempt) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-4xl mx-auto"
            >
                <div className="bg-white border border-zinc-100 rounded-2xl p-8">
                    <h2 className="text-3xl font-bold mb-2">Exam Report</h2>
                    <p className="text-zinc-500 mb-8">{currentAttempt.exam.title}</p>

                    {/* Score Summary */}
                    <div className="grid grid-cols-3 gap-6 mb-12">
                        <div className="bg-linear-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-2xl p-6 text-center">
                            <div className="text-4xl font-bold text-emerald-600 mb-2">{currentAttempt.marks_obtained}</div>
                            <div className="text-sm text-emerald-700">Marks Obtained</div>
                        </div>
                        <div className="bg-linear-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-2xl p-6 text-center">
                            <div className="text-4xl font-bold text-blue-600 mb-2">{currentAttempt.total_marks}</div>
                            <div className="text-sm text-blue-700">Total Marks</div>
                        </div>
                        <div className="bg-linear-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-2xl p-6 text-center">
                            <div className="text-4xl font-bold text-purple-600 mb-2">
                                {Math.round((currentAttempt.marks_obtained / currentAttempt.total_marks) * 100)}%
                            </div>
                            <div className="text-sm text-purple-700">Percentage</div>
                        </div>
                    </div>

                    {/* Questions Review */}
                    <div className="space-y-6 mb-8">
                        <h3 className="text-xl font-bold">Answer Review</h3>
                        {currentAttempt.exam.questions.map((question, idx) => {
                            let userAnswer = currentAttempt.user_answers[question.id];
                            let displayUserAnswer = userAnswer;
                            let displayCorrectAnswer = JSON.stringify(currentAttempt.exam.answers[question.id]);

                            // For match questions, format for readable display
                            if (question.type === 'match' && question.rightItems) {
                                // Format user answer
                                const userMatches: string[] = [];
                                question.rightItems.forEach((rightItem, itemIdx) => {
                                    const matchKey = `${question.id}-match-${itemIdx}`;
                                    if (currentAttempt.user_answers[matchKey]) {
                                        const userLetter = currentAttempt.user_answers[matchKey];
                                        const leftItemIndex = userLetter.charCodeAt(0) - 97;
                                        const leftItem = question.leftItems?.[leftItemIndex];
                                        userMatches.push(`${itemIdx + 1}. ${rightItem} → ${userLetter} (${leftItem})`);
                                    } else {
                                        userMatches.push(`${itemIdx + 1}. ${rightItem} → (No match)`);
                                    }
                                });
                                displayUserAnswer = userMatches.length > 0 ? userMatches.join('\n') : '(No answer)';

                                // Format correct answer
                                const correctMatches = currentAttempt.exam.answers[question.id];
                                if (typeof correctMatches === 'object' && !Array.isArray(correctMatches)) {
                                    const correctMatchTexts: string[] = [];
                                    question.rightItems?.forEach((rightItem, itemIdx) => {
                                        const correctLetter = correctMatches[itemIdx];
                                        if (correctLetter) {
                                            const leftItemIndex = correctLetter.charCodeAt(0) - 97;
                                            const leftItem = question.leftItems?.[leftItemIndex];
                                            correctMatchTexts.push(`${itemIdx + 1}. ${rightItem} → ${correctLetter} (${leftItem})`);
                                        }
                                    });
                                    displayCorrectAnswer = correctMatchTexts.join('\n');
                                }
                            }

                            const correctAnswer = currentAttempt.exam.answers[question.id];
                            const evaluation = questionEvaluations[question.id];
                            const marksObtained = evaluation?.marks_obtained || 0;
                            const isCorrect = marksObtained === question.marks;
                            const isPartiallyCorrect = marksObtained > 0 && marksObtained < question.marks;
                            
                            let cardStyles = 'border rounded-2xl p-6 ';
                            if (isCorrect) {
                                cardStyles += 'bg-emerald-50 border-emerald-300';
                            } else if (isPartiallyCorrect) {
                                cardStyles += 'bg-yellow-50 border-yellow-300';
                            } else {
                                cardStyles += 'bg-red-50 border-red-300';
                            }

                            return (
                                <div key={question.id} className={cardStyles}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h4 className="font-bold text-lg">Question {idx + 1}</h4>
                                                {isCorrect && <span className="text-emerald-600 font-bold text-sm px-2 py-1 bg-emerald-100 rounded">✓ Correct</span>}
                                                {isPartiallyCorrect && <span className="text-yellow-600 font-bold text-sm px-2 py-1 bg-yellow-100 rounded">◐ Partial</span>}
                                                {!isCorrect && !isPartiallyCorrect && <span className="text-red-600 font-bold text-sm px-2 py-1 bg-red-100 rounded">✗ Wrong</span>}
                                            </div>
                                            <p className={isCorrect ? 'text-emerald-900' : isPartiallyCorrect ? 'text-yellow-900' : 'text-red-900'}>{question.question}</p>
                                        </div>
                                        <div className="text-right ml-4">
                                            <div className={`text-sm font-bold mb-1 ${isCorrect ? 'text-emerald-600' : 'text-red-600'}`}>{marksObtained}/{question.marks} marks</div>
                                        </div>
                                    </div>

                                    <div className="mt-6 space-y-4">
                                        <div className="bg-white p-4 rounded-lg border border-zinc-200">
                                            <p className="text-sm font-semibold mb-1">Your Answer:</p>
                                            <p className="text-zinc-900 whitespace-pre-line">{displayUserAnswer || '(No answer provided)'}</p>
                                        </div>
                                        <div className="bg-white p-4 rounded-lg border border-emerald-200">
                                            <p className="text-sm text-emerald-700 font-semibold mb-1">Correct Answer:</p>
                                            <p className="text-emerald-900 whitespace-pre-line">{displayCorrectAnswer}</p>
                                        </div>
                                        {evaluation?.feedback && (
                                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                                <p className="text-sm text-blue-700 font-semibold mb-1">Feedback:</p>
                                                <p className="text-blue-900">{evaluation.feedback}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-8 border-t border-zinc-100">
                        <button
                            onClick={goBack}
                            className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-semibold hover:bg-zinc-50 transition-colors"
                        >
                            Back to Exams
                        </button>
                        <button
                            onClick={() => startExam(currentAttempt.exam)}
                            className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-semibold hover:bg-zinc-800 transition-colors"
                        >
                            Retake Exam
                        </button>
                        <button
                            onClick={generatePracticeDiagrams}
                            disabled={isGenerating}
                            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGenerating && <Loader2 size={18} className="animate-spin" />}
                            {isGenerating ? 'Generating...' : 'Practice Diagrams'}
                        </button>
                    </div>

                    {/* Practice Diagrams Section */}
                    {showDiagrams && practiceDiagrams.length > 0 && (
                        <div className="mt-12 pt-12 border-t border-zinc-100">
                            <h3 className="text-2xl font-bold mb-6">Topics to Practice</h3>
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-8">
                                <div className="prose prose-sm max-w-none text-zinc-800">
                                    <ol className="list-decimal list-inside space-y-3">
                                        {practiceDiagrams.map((topic, idx) => (
                                            <li key={idx} className="text-lg font-medium text-zinc-900">
                                                <Markdown>{topic}</Markdown>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        );
    }

    return null;
}
