import React, { useState, useEffect, useRef } from 'react';
import {
    BookOpen,
    MessageSquare,
    LayoutDashboard,
    Plus,
    Search,
    BrainCircuit,
    ChevronRight,
    Clock,
    CheckCircle2,
    Trophy,
    ArrowRight,
    X,
    Loader2,
    Sparkles,
    LogOut,
    Users,
    Calendar,
    Menu,
    AlertCircle,
    Upload,
    FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Note, Flashcard, ProgressStats, User, StudyPlan, StudyGroup } from './types';
import { tutorChat } from './services/sarvam';
import { supabase } from './lib/supabase';
import * as db from './lib/db';
import AuthPage from './components/AuthPage';
import StudyGroupsPage from './components/StudyGroupsPage';
import ExamPage from './components/ExamPage';
import ResetPasswordPage from './components/ResetPasswordPage';

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active
                ? 'bg-black text-white shadow-lg shadow-black/10'
                : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
            }`}
    >
        <Icon size={20} />
        <span className="font-medium">{label}</span>
    </button>
);

const Card = ({ children, className = "", onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
    <div onClick={onClick} className={`bg-white border border-zinc-100 rounded-2xl shadow-sm ${className}`}>
        {children}
    </div>
);

// --- Main App ---

export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'notes' | 'tutor' | 'flashcards' | 'plans' | 'groups' | 'exams'>('dashboard');
    const [notes, setNotes] = useState<Note[]>([]);
    const [stats, setStats] = useState<ProgressStats | null>(null);
    const [isAddingNote, setIsAddingNote] = useState(false);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [newNote, setNewNote] = useState({ title: '', content: '' });
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [editedNote, setEditedNote] = useState<{ title: string; content: string; summary: string; tags: string }>({ title: '', content: '', summary: '', tags: '' });
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [dueCards, setDueCards] = useState<Flashcard[]>([]);
    const [allCards, setAllCards] = useState<Flashcard[]>([]);
    const [currentReviewCard, setCurrentReviewCard] = useState<Flashcard | null>(null);
    const [showAnswer, setShowAnswer] = useState(false);
    const [cardViewMode, setCardViewMode] = useState<'due' | 'all'>('due');

    // New States
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
    const [studyGroups, setStudyGroups] = useState<StudyGroup[]>([]);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [pendingToolCalls, setPendingToolCalls] = useState<any[]>([]);
    const [allFlashcards, setAllFlashcards] = useState<Flashcard[]>([]);
    const [selectedFlashcard, setSelectedFlashcard] = useState<Flashcard | null>(null);
    const [isEditingCard, setIsEditingCard] = useState(false);
    const [editedCard, setEditedCard] = useState<{ question: string, answer: string }>({ question: '', answer: '' });
    const [tutorDocuments, setTutorDocuments] = useState<{ name: string; content: string }[]>([]);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);
    const [flashcardView, setFlashcardView] = useState<'due' | 'all'>('all');
    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [isEditingPlan, setIsEditingPlan] = useState(false);
    const [editedPlan, setEditedPlan] = useState<{ title: string, content: string }>({ title: '', content: '' });

    useEffect(() => {
        checkAuth();

        // Listen for password recovery session
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setShowResetPassword(true);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (user) {
            fetchNotes();
            fetchStats();
            fetchDueCards();
            fetchAllFlashcards();
            fetchStudyPlans();
            fetchStudyGroups();
        }
    }, [user]);

    useEffect(() => {
        if (selectedFlashcard && !selectedFlashcard.last_reviewed) {
            markCardAsReviewed(selectedFlashcard.id);
        }
    }, [selectedFlashcard]);

    const checkAuth = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                setUser({
                    id: authUser.id,
                    email: authUser.email || '',
                    full_name: authUser.user_metadata?.full_name || '',
                    email_verified: authUser.email_confirmed_at ? true : false
                });
            }
        } catch (e) {
            console.error("Auth check failed");
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setShowLogoutConfirm(false);
    };

    const fetchNotes = async () => {
        if (!user?.id) return;
        try {
            const data = await db.fetchNotes(user.id);
            setNotes(data);
        } catch (error) {
            console.error('Error fetching notes:', error);
        }
    };

    const fetchStats = async () => {
        if (!user?.id) return;
        try {
            const data = await db.fetchProgressStats(user.id);
            setStats(data);
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const fetchDueCards = async () => {
        if (!user?.id) return;
        try {
            const data = await db.fetchDueFlashcards(user.id);
            setDueCards(data);
        } catch (error) {
            console.error('Error fetching due cards:', error);
        }
    };

    const fetchAllCards = async () => {
        if (!user?.id) return;
        try {
            const data = await db.fetchFlashcards(user.id);
            setAllFlashcards(data);
        } catch (error) {
            console.error('Error fetching flashcards:', error);
        }
    };

    const fetchStudyPlans = async () => {
        if (!user?.id) return;
        try {
            const data = await db.fetchStudyPlans(user.id);
            setStudyPlans(data);
        } catch (error) {
            console.error('Error fetching study plans:', error);
        }
    };

    const fetchStudyGroups = async () => {
        try {
            const data = await db.fetchStudyGroups();
            setStudyGroups(data);
        } catch (error) {
            console.error('Error fetching study groups:', error);
        }
    };

    const fetchAllFlashcards = async () => {
        if (!user?.id) return;
        try {
            const flashcards = await db.fetchFlashcards(user.id);
            setAllFlashcards(flashcards);
        } catch (e) {
            console.error("Failed to fetch flashcards:", e);
        }
    };

    const handleUpdateFlashcard = async () => {
        if (!selectedFlashcard || !user?.id) return;
        try {
            await db.updateFlashcard(
                user.id,
                selectedFlashcard.id,
                editedCard.question,
                editedCard.answer
            );
            setSelectedFlashcard(null);
            setIsEditingCard(false);
            fetchAllFlashcards();
        } catch (e) {
            console.error("Failed to update flashcard:", e);
        }
    };

    const handleDeleteFlashcard = async () => {
        if (!selectedFlashcard || !user?.id) return;
        try {
            await db.deleteFlashcard(user.id, selectedFlashcard.id);
            setSelectedFlashcard(null);
            fetchAllFlashcards();
        } catch (e) {
            console.error("Failed to delete flashcard:", e);
        }
    };

    const markCardAsReviewed = async (cardId: string) => {
        if (!user?.id) return;
        try {
            await db.reviewFlashcard(user.id, cardId, 4);
            fetchDueCards();
            fetchStats();
        } catch (e) {
            console.error("Failed to mark card as reviewed:", e);
        }
    };

    const handleUpdatePlan = async () => {
        if (!selectedPlan || !user?.id) return;
        try {
            await db.updateStudyPlan(
                user.id,
                selectedPlan.id,
                editedPlan.title,
                editedPlan.content
            );
            setSelectedPlan(null);
            setIsEditingPlan(false);
            fetchStudyPlans();
        } catch (e) {
            console.error("Failed to update study plan:", e);
        }
    };

    const handleDeletePlan = async () => {
        if (!selectedPlan || !user?.id) return;
        try {
            await db.deleteStudyPlan(user.id, selectedPlan.id);
            setSelectedPlan(null);
            fetchStudyPlans();
        } catch (e) {
            console.error("Failed to delete study plan:", e);
        }
    };

    const handleUpdateNote = async () => {
        if (!selectedNote || !user?.id) return;
        try {
            await db.updateNote(
                user.id,
                selectedNote.id,
                editedNote.title,
                editedNote.content,
                editedNote.summary,
                editedNote.tags
            );
            setSelectedNote(null);
            setIsEditingNote(false);
            fetchNotes();
        } catch (e) {
            console.error("Failed to update note:", e);
        }
    };

    const handleDeleteNote = async () => {
        if (!selectedNote || !user?.id) return;
        try {
            await db.deleteNote(user.id, selectedNote.id);
            setSelectedNote(null);
            fetchNotes();
            fetchStats();
            fetchDueCards();
        } catch (e) {
            console.error("Failed to delete note:", e);
        }
    };

    const handleToolCall = (actions: any[]) => {
        // Transform AIAction objects to tool call format with name and args
        const toolCalls = actions.map((action) => {
            const { type, ...args } = action;
            return { name: type, args };
        });
        setPendingToolCalls(toolCalls);
    };

    const executeToolCalls = async () => {
        if (!user?.id) return;

        const calls = [...pendingToolCalls];
        setPendingToolCalls([]);

        for (const call of calls) {
            const { name, args } = call;
            try {
                if (name === 'create_note') {
                    await db.createNote(user.id, args.title, args.content, args.summary || '', args.tags || '');
                } else if (name === 'update_note') {
                    await db.updateNote(user.id, args.id, args.title, args.content, args.summary || '', args.tags || '');
                } else if (name === 'delete_note') {
                    await db.deleteNote(user.id, args.id);
                } else if (name === 'create_flashcard') {
                    // note_id should only be included if it's a valid UUID string, not a number
                    const noteId = args.note_id && typeof args.note_id === 'string' && args.note_id.includes('-') ? args.note_id : null;
                    await db.createFlashcard(user.id, args.question, args.answer, noteId, args.title);
                } else if (name === 'update_flashcard') {
                    await db.updateFlashcard(user.id, args.id, args.question, args.answer);
                } else if (name === 'delete_flashcard') {
                    await db.deleteFlashcard(user.id, args.id);
                } else if (name === 'create_study_plan') {
                    await db.createStudyPlan(user.id, args.title, args.content);
                } else if (name === 'update_study_plan') {
                    await db.updateStudyPlan(user.id, args.id, args.title, args.content);
                } else if (name === 'delete_study_plan') {
                    await db.deleteStudyPlan(user.id, args.id);
                }
            } catch (err) {
                console.error(`Tool call failed (${name}):`, err, "args:", args);
            }
        }
        // Refresh data
        fetchNotes();
        fetchDueCards();
        fetchAllFlashcards();
        fetchStudyPlans();
        fetchStats();
    };

    const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        setIsUploadingDoc(true);
        try {
            for (const file of Array.from(files)) {
                const text = await file.text();
                setTutorDocuments(prev => [...prev, { name: file.name, content: text }]);
            }
        } catch (error) {
            console.error("File upload error:", error);
        } finally {
            setIsUploadingDoc(false);
        }
    };

    const removeDocument = (index: number) => {
        setTutorDocuments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;
        const userMsg = chatInput;
        setChatInput('');

        // Add user message to chat history first
        const newChatMessages = [...chatMessages, { role: 'user' as const, text: userMsg }];
        setChatMessages(newChatMessages);
        setIsChatLoading(true);

        try {
            // Include documents context only on first message (token efficiency)
            let messageToSend = userMsg;
            if (tutorDocuments.length > 0 && newChatMessages.length === 1) {
                messageToSend = `Context from documents:\n${tutorDocuments.map(doc => `[${doc.name}]\n${doc.content}`).join('\n---\n')}\n\nQuestion: ${userMsg}`;
            }

            // Pass the updated chat history (AI will use only recent 4 turns for efficiency)
            const aiResponse = await tutorChat(newChatMessages, messageToSend, handleToolCall);
            setChatMessages(prev => [...prev, { role: 'ai', text: aiResponse || "I've processed your request." }]);
        } catch (error) {
            console.error("Chat error:", error);
            // Remove the user message if there was an error
            setChatMessages(prev => prev.slice(0, -1));
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.title || !newNote.content || !user?.id) return;
        setIsAnalyzing(true);
        try {
            const prompt = `Analyze these notes and respond with ONLY valid JSON:
{"summary": "brief summary", "tags": ["tag1", "tag2"]}

Notes: ${newNote.content}`;
            
            const response = await tutorChat([], prompt);
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: "", tags: [] };
            
            await db.createNote(
                user.id,
                newNote.title,
                newNote.content,
                analysis.summary || newNote.content.substring(0, 100),
                (analysis.tags || []).join(',')
            );
            await db.updateProgressNoteCreated(user.id);

            setNewNote({ title: '', content: '' });
            setIsAddingNote(false);
            fetchNotes();
            fetchStats();
        } catch (error) {
            console.error("Error adding note:", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleReview = async (quality: number) => {
        if (!currentReviewCard || !user?.id) return;
        try {
            await db.reviewFlashcard(user.id, currentReviewCard.id, quality);
            setShowAnswer(false);
            setCurrentReviewCard(null);
            fetchDueCards();
            fetchStats();
        } catch (e) {
            console.error("Failed to review card:", e);
        }
    };

    if (isAuthLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-white">
                <Loader2 className="animate-spin text-indigo-600" size={40} />
            </div>
        );
    }

    if (showResetPassword) {
        return <ResetPasswordPage onSuccess={() => {
            setShowResetPassword(false);
            checkAuth();
        }} />;
    }

    if (!user) {
        return <AuthPage onSuccess={checkAuth} />;
    }

    return (
        <div className="flex h-screen bg-[#F8F9FA] text-zinc-900 font-sans overflow-hidden">
            {/* Mobile Menu Toggle */}
            <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-xl shadow-md border border-zinc-100"
            >
                <Menu size={24} />
            </button>

            {/* Sidebar */}
            <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-72 border-r border-zinc-200 bg-white p-6 flex flex-col gap-8 transition-transform duration-300 lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="flex items-center gap-3 px-2">
                    <img src="/favicon-32x32.png" alt="Tchr Logo" className="w-10 h-10 rounded-xl shadow-lg shadow-indigo-500/20" loading="eager" />
                    <h1 className="text-2xl font-bold tracking-tight">Tchr</h1>
                </div>

                <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 ml-4">Main</div>
                    <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} />
                    <SidebarItem icon={BookOpen} label="My Notes" active={activeTab === 'notes'} onClick={() => { setActiveTab('notes'); setIsSidebarOpen(false); }} />
                    <SidebarItem icon={MessageSquare} label="AI Tutor" active={activeTab === 'tutor'} onClick={() => { setActiveTab('tutor'); setIsSidebarOpen(false); }} />
                    <SidebarItem icon={Sparkles} label="Flashcards" active={activeTab === 'flashcards'} onClick={() => { setActiveTab('flashcards'); setIsSidebarOpen(false); }} />

                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-6 mb-2 ml-4">Planning & Assessment</div>
                    <SidebarItem icon={Calendar} label="Study Plan" active={activeTab === 'plans'} onClick={() => { setActiveTab('plans'); setIsSidebarOpen(false); }} />
                    <SidebarItem icon={FileText} label="Exams" active={activeTab === 'exams'} onClick={() => { setActiveTab('exams'); setIsSidebarOpen(false); }} />
                    <SidebarItem icon={Users} label="Study Groups" active={activeTab === 'groups'} onClick={() => { setActiveTab('groups'); setIsSidebarOpen(false); }} />

                </nav>

                <div className="pt-6 border-t border-zinc-100">
                    <button
                        onClick={() => setShowLogoutConfirm(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-all group"
                    >
                        <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 custom-scrollbar ${activeTab === 'groups' ? 'overflow-hidden flex' : 'overflow-y-auto p-4 md:p-8 lg:p-12'}`}>
                <div className={activeTab === 'groups' ? 'w-full h-full' : 'w-full'}>
                    <AnimatePresence mode="wait">
                        {activeTab === 'dashboard' && (
                            <motion.div
                                key="dashboard"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="max-w-5xl mx-auto space-y-8"
                            >
                                <header className="flex justify-between items-end">
                                    <div>
                                        <h2 className="text-3xl font-bold tracking-tight">Welcome back, Scholar</h2>
                                        <p className="text-zinc-500 mt-1">Here's what's happening with your studies today.</p>
                                    </div>
                                </header>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <Card className="p-6">
                                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                                            <BookOpen size={20} />
                                        </div>
                                        <div className="text-2xl font-bold">{stats?.totalNotes || 0}</div>
                                        <div className="text-sm text-zinc-500">Total Notes</div>
                                    </Card>
                                    <Card className="p-6">
                                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                                            <Sparkles size={20} />
                                        </div>
                                        <div className="text-2xl font-bold">{stats?.totalCards || 0}</div>
                                        <div className="text-sm text-zinc-500">Flashcards Created</div>
                                    </Card>
                                    <Card className="p-6">
                                        <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mb-4">
                                            <Clock size={20} />
                                        </div>
                                        <div className="text-2xl font-bold">{dueCards.length}</div>
                                        <div className="text-sm text-zinc-500">Cards Due for Review</div>
                                    </Card>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <section>
                                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <Clock size={18} className="text-zinc-400" />
                                            Recent Notes
                                        </h3>
                                        <div className="space-y-3">
                                            {notes.slice(0, 3).map(note => (
                                                <Card key={note.id} onClick={() => setSelectedNote(note)} className="p-4 hover:border-zinc-300 transition-colors cursor-pointer group">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h4 className="font-semibold group-hover:text-black">{note.title}</h4>
                                                            <p className="text-xs text-zinc-400 mt-1">
                                                                {new Date(note.created_at).toLocaleDateString()} • {note.tags.split(',').length} tags
                                                            </p>
                                                        </div>
                                                        <ChevronRight size={16} className="text-zinc-300 group-hover:text-zinc-900" />
                                                    </div>
                                                </Card>
                                            ))}
                                            {notes.length === 0 && (
                                                <div className="text-center py-8 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 text-zinc-400 text-sm">
                                                    No notes yet. Start by adding your first one!
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    <section>
                                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <CheckCircle2 size={18} className="text-zinc-400" />
                                            Study Progress
                                        </h3>
                                        <Card className="p-6 h-60 flex flex-col justify-center items-center text-center">
                                            <div className="relative w-32 h-32 mb-4">
                                                <svg className="w-full h-full transform -rotate-90">
                                                    <circle
                                                        cx="64"
                                                        cy="64"
                                                        r="58"
                                                        stroke="currentColor"
                                                        strokeWidth="8"
                                                        fill="transparent"
                                                        className="text-zinc-100"
                                                    />
                                                    <circle
                                                        cx="64"
                                                        cy="64"
                                                        r="58"
                                                        stroke="currentColor"
                                                        strokeWidth="8"
                                                        fill="transparent"
                                                        strokeDasharray={364.4}
                                                        strokeDashoffset={364.4 * (1 - Math.min(((stats as any)?.today?.cards_reviewed || 0) / 10, 1))}
                                                        className="text-black transition-all duration-1000"
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className="text-2xl font-bold">{Math.round(Math.min((((stats as any)?.today?.cards_reviewed || 0) / 10) * 100, 100))}%</span>
                                                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Daily Goal</span>
                                                </div>
                                            </div>
                                            <p className="text-sm text-zinc-500">Keep it up! You're almost at your daily target.</p>
                                        </Card>
                                    </section>
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'notes' && (
                            <motion.div
                                key="notes"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="max-w-5xl mx-auto"
                            >
                                <div className="flex justify-between items-center mb-8">
                                    <h2 className="text-3xl font-bold tracking-tight">My Notes</h2>
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Search notes..."
                                                className="pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 w-64"
                                            />
                                        </div>
                                        <button
                                            onClick={() => setIsAddingNote(true)}
                                            className="bg-black text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 hover:bg-zinc-800 transition-colors shadow-lg shadow-black/10"
                                        >
                                            <Plus size={18} />
                                            New Note
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {notes.map(note => (
                                        <Card key={note.id} className="p-6 flex flex-col h-full hover:shadow-xl hover:shadow-black/5 transition-all">
                                            <div className="flex-1">
                                                <div className="flex flex-wrap gap-1 mb-3">
                                                    {note.tags.split(',').map(tag => (
                                                        <span key={tag} className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase rounded-md">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                                <h3 className="text-lg font-bold mb-2">{note.title}</h3>
                                                <div className="markdown-body text-zinc-500 text-sm line-clamp-3 mb-4">
                                                    <Markdown>{note.summary}</Markdown>
                                                </div>
                                            </div>
                                            <div className="pt-4 border-t border-zinc-50 flex justify-between items-center">
                                                <span className="text-xs text-zinc-400">{new Date(note.created_at).toLocaleDateString()}</span>
                                                <button onClick={() => setSelectedNote(note)} className="text-black font-semibold text-sm flex items-center gap-1 hover:gap-2 transition-all">
                                                    View Details <ArrowRight size={14} />
                                                </button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'tutor' && (
                            <motion.div
                                key="tutor"
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="max-w-4xl mx-auto h-full flex flex-col"
                            >
                                <div className="mb-6">
                                    <h2 className="text-3xl font-bold tracking-tight">AI Tutor</h2>
                                    <p className="text-zinc-500">Ask me anything about your subjects or notes.</p>
                                </div>

                                <Card className="flex-1 flex flex-col overflow-hidden">
                                    {/* Documents Section */}
                                    {tutorDocuments.length > 0 && (
                                        <div className="p-4 bg-indigo-50 border-b border-indigo-200">
                                            <div className="text-sm font-semibold text-indigo-900 mb-2">Attached Documents ({tutorDocuments.length})</div>
                                            <div className="flex flex-wrap gap-2">
                                                {tutorDocuments.map((doc, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 text-xs">
                                                        <span className="text-indigo-700 font-medium truncate max-w-37.5">{doc.name}</span>
                                                        <button
                                                            onClick={() => removeDocument(idx)}
                                                            className="text-indigo-500 hover:text-indigo-700 transition-colors"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                        {chatMessages.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                                <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center text-zinc-300 mb-4">
                                                    <MessageSquare size={32} />
                                                </div>
                                                <h3 className="text-lg font-bold text-zinc-900">Start a conversation</h3>
                                                <p className="text-zinc-500 max-w-xs mt-2">
                                                    Upload documents, then ask questions. Try: "Explain photosynthesis" or "Solve this problem step-by-step"
                                                </p>
                                            </div>
                                        )}
                                        {chatMessages.map((msg, i) => (
                                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${msg.role === 'user'
                                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                                        : 'bg-white border border-zinc-100 text-zinc-800 rounded-tl-none'
                                                    }`}>
                                                    <div className="markdown-body prose prose-sm max-w-none">
                                                        <Markdown>{msg.text}</Markdown>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {isChatLoading && (
                                            <div className="flex justify-start">
                                                <div className="bg-zinc-100 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                                                    <Loader2 size={16} className="animate-spin text-zinc-400" />
                                                    <span className="text-sm text-zinc-400">Tchr is thinking...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 space-y-3">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                                placeholder="Type your question here..."
                                                className="flex-1 px-4 py-3 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                                            />
                                            <label className="p-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-600 cursor-pointer transition-all" title="Attach documents">
                                                <Upload size={20} />
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept=".txt,.pdf,.doc,.docx"
                                                    onChange={handleDocumentUpload}
                                                    disabled={isUploadingDoc}
                                                    className="hidden"
                                                />
                                            </label>
                                            <button
                                                onClick={handleSendMessage}
                                                disabled={isChatLoading || !chatInput.trim()}
                                                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold disabled:opacity-50 transition-opacity shadow-lg shadow-indigo-600/20"
                                            >
                                                Send
                                            </button>
                                        </div>
                                        {isUploadingDoc && (
                                            <div className="flex items-center gap-2 text-sm text-zinc-600 bg-white px-4 py-2 rounded-lg border border-zinc-200">
                                                <Loader2 size={16} className="animate-spin" />
                                                <span>Reading document...</span>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            </motion.div>
                        )}

                        {activeTab === 'flashcards' && (
                            <motion.div
                                key="flashcards"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="max-w-5xl mx-auto"
                            >


                                <div className="grid grid-cols-3 gap-6 mb-8">
                                    <Card className="p-6 text-center">
                                        <Clock size={24} className="mx-auto mb-2 text-zinc-600" />
                                        <div className="text-lg font-bold">{dueCards.length}</div>
                                        <div className="text-xs text-zinc-500">Cards Due</div>
                                    </Card>
                                    <Card className="p-6 text-center">
                                        <BookOpen size={24} className="mx-auto mb-2 text-zinc-600" />
                                        <div className="text-lg font-bold">{allFlashcards.length}</div>
                                        <div className="text-xs text-zinc-500">Total Cards</div>
                                    </Card>
                                    <Card className="p-6 text-center">
                                        <Trophy size={24} className="mx-auto mb-2 text-zinc-600" />
                                        <div className="text-lg font-bold">{(stats as any)?.today?.cards_reviewed || 0}</div>
                                        <div className="text-xs text-zinc-500">Reviewed Today</div>
                                    </Card>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <BookOpen size={20} className="text-zinc-400" />
                                            Flashcards
                                        </h3>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setFlashcardView('due')}
                                                className={`px-4 py-2 rounded-lg font-semibold transition-all ${flashcardView === 'due'
                                                        ? 'bg-black text-white'
                                                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                                    }`}
                                            >
                                                Due ({dueCards.length})
                                            </button>
                                            <button
                                                onClick={() => setFlashcardView('all')}
                                                className={`px-4 py-2 rounded-lg font-semibold transition-all ${flashcardView === 'all'
                                                        ? 'bg-black text-white'
                                                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                                    }`}
                                            >
                                                All ({allFlashcards.length})
                                            </button>
                                        </div>
                                    </div>

                                    {flashcardView === 'due' ? (
                                        <>
                                            {dueCards.length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {dueCards.map(card => (
                                                        <Card key={card.id} className="p-4 hover:border-zinc-300 transition-colors cursor-pointer group" onClick={() => {
                                                            setSelectedFlashcard(card);
                                                            setEditedCard({ question: card.question, answer: card.answer });
                                                        }}>
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div className="flex-1">
                                                                    {card.title && (
                                                                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">{card.title}</p>
                                                                    )}
                                                                    <p className="text-sm font-semibold line-clamp-2 group-hover:text-black">{card.question}</p>
                                                                </div>
                                                            </div>
                                                            <div className="pt-3 border-t border-zinc-50 text-xs text-zinc-400 flex justify-between">
                                                                <span>{new Date(card.created_at).toLocaleDateString()}</span>
                                                                <span className="font-bold text-zinc-900">View</span>
                                                            </div>
                                                        </Card>
                                                    ))}
                                                </div>
                                            ) : (
                                                <Card className="p-12 text-center">
                                                    <CheckCircle2 size={32} className="mx-auto text-emerald-300 mb-4" />
                                                    <p className="text-zinc-500">No cards due for review. Great job!</p>
                                                </Card>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {allFlashcards.length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {allFlashcards.map(card => (
                                                        <Card key={card.id} className="p-4 hover:border-zinc-300 transition-colors cursor-pointer group" onClick={() => {
                                                            setSelectedFlashcard(card);
                                                            setEditedCard({ question: card.question, answer: card.answer });
                                                        }}>
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div className="flex-1">
                                                                    {card.title && (
                                                                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">{card.title}</p>
                                                                    )}
                                                                    <p className="text-sm font-semibold line-clamp-2 group-hover:text-black">{card.question}</p>
                                                                </div>
                                                            </div>
                                                            <div className="pt-3 border-t border-zinc-50 text-xs text-zinc-400 flex justify-between">
                                                                <span>{new Date(card.created_at).toLocaleDateString()}</span>
                                                                <span className="font-bold text-zinc-900">View</span>
                                                            </div>
                                                        </Card>
                                                    ))}
                                                </div>
                                            ) : (
                                                <Card className="p-12 text-center">
                                                    <BookOpen size={32} className="mx-auto text-zinc-300 mb-4" />
                                                    <p className="text-zinc-500">No flashcards yet. Ask the AI tutor to create some!</p>
                                                </Card>
                                            )}
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                        {activeTab === 'plans' && (
                            <motion.div key="plans" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">
                                <h2 className="text-3xl font-bold mb-8">Study Plans</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {studyPlans.map(plan => (
                                        <Card key={plan.id} className="p-6 cursor-pointer hover:border-zinc-300 transition-all group">
                                            <h3 className="text-xl font-bold mb-4 group-hover:text-black">{plan.title}</h3>
                                            <div className="markdown-body prose prose-sm mb-4 line-clamp-3">
                                                <Markdown>{plan.content}</Markdown>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedPlan(plan);
                                                        setEditedPlan({ title: plan.title, content: plan.content });
                                                    }}
                                                    className="flex-1 text-sm px-3 py-2 border border-zinc-200 rounded-lg hover:bg-zinc-50 font-semibold transition-colors"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        </Card>
                                    ))}
                                    {studyPlans.length === 0 && (
                                        <div className="col-span-full p-12 text-center bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
                                            <Calendar size={48} className="mx-auto text-zinc-300 mb-4" />
                                            <h3 className="text-lg font-bold">No study plans yet</h3>
                                            <p className="text-zinc-500">Ask the AI Tutor to generate a personalized study plan for you!</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {activeTab === 'groups' && user && (
                            <StudyGroupsPage userId={user.id} />
                        )}

                        {activeTab === 'exams' && user && (
                            <ExamPage user={user} />
                        )}

                    </AnimatePresence>
                </div>
            </main>

            {/* Tool Call Confirmation Modal */}
            <AnimatePresence>
                {pendingToolCalls.length > 0 && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            <div className="p-8 flex flex-col flex-1 overflow-hidden">
                                <div className="flex items-center gap-4 mb-6 shrink-0">
                                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                                        <BrainCircuit size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold">AI Action Required</h3>
                                        <p className="text-zinc-500 text-sm">The AI tutor wants to perform {pendingToolCalls.length} action{pendingToolCalls.length !== 1 ? 's' : ''}.</p>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-8 overflow-y-auto flex-1 pr-2">
                                    {pendingToolCalls.map((call, idx) => (
                                        <div key={idx} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 shrink-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Sparkles size={14} className="text-zinc-400" />
                                                <span className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                                                    {call.name.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-zinc-900 font-medium text-sm">
                                                {call.args.title || call.args.question || `Action ID: ${call.args.id}`}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-3 shrink-0">
                                    <button
                                        onClick={() => setPendingToolCalls([])}
                                        className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-bold hover:bg-zinc-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={executeToolCalls}
                                        className="flex-2 bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors"
                                    >
                                        Confirm Actions
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Logout Confirmation Modal */}
            <AnimatePresence>
                {showLogoutConfirm && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white rounded-[40px] p-10 max-w-md w-full text-center shadow-2xl border border-zinc-100"
                        >
                            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertCircle size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-zinc-900 mb-4">Are you sure you want to leave?</h3>
                            <p className="text-zinc-500 mb-8 leading-relaxed">
                                Logging out will pause your learning momentum. Your daily streak might be at risk, and your AI tutor will miss our sessions.
                            </p>
                            <div className="space-y-3">
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-600/20 hover:scale-[1.02] transition-transform"
                                >
                                    No, I want to keep learning!
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full py-4 text-zinc-400 font-semibold hover:text-red-500 transition-colors"
                                >
                                    Yes, log me out anyway
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* View Flashcard Modal */}
            <AnimatePresence>
                {selectedFlashcard && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setSelectedFlashcard(null);
                                setShowAnswer(false);
                                setIsEditingCard(false);
                            }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
                        >
                            {!isEditingCard ? (
                                <div className="p-8 perspective-1000">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-2xl font-bold">View Flashcard</h2>
                                        <button
                                            onClick={() => {
                                                setSelectedFlashcard(null);
                                                setShowAnswer(false);
                                            }}
                                            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="relative h-75 w-full mb-6">
                                        <motion.div
                                            animate={{ rotateY: showAnswer ? 180 : 0 }}
                                            transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
                                            className="w-full h-full relative preserve-3d cursor-pointer"
                                            onClick={() => !showAnswer && setShowAnswer(true)}
                                        >
                                            {/* Front */}
                                            <Card className={`absolute inset-0 p-12 flex flex-col items-center justify-center text-center backface-hidden ${showAnswer ? 'pointer-events-none' : ''}`}>
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Question</span>
                                                <h3 className="text-xl font-bold leading-tight">{selectedFlashcard.question}</h3>
                                                <p className="mt-8 text-zinc-400 text-sm italic">Click to reveal answer</p>
                                            </Card>

                                            {/* Back */}
                                            <Card className="absolute inset-0 p-12 flex flex-col items-center justify-center text-center backface-hidden rotate-y-180">
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4">Answer</span>
                                                <h3 className="text-xl font-bold leading-tight text-emerald-600">{selectedFlashcard.answer}</h3>
                                                <p className="mt-8 text-zinc-400 text-sm italic">Click to see question</p>
                                            </Card>
                                        </motion.div>
                                    </div>

                                    {selectedFlashcard.last_reviewed && (
                                        <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 mb-6 text-sm">
                                            <p className="text-xs text-indigo-600 font-bold mb-1">LAST REVIEWED</p>
                                            <p className="text-indigo-900">{new Date(selectedFlashcard.last_reviewed).toLocaleString()}</p>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setIsEditingCard(true)}
                                            className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-bold hover:bg-zinc-50 transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={handleDeleteFlashcard}
                                            className="flex-1 px-6 py-3 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedFlashcard(null);
                                                setShowAnswer(false);
                                            }}
                                            className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8">
                                    <div className="flex justify-between items-center mb-6">
                                        <h2 className="text-2xl font-bold">Edit Flashcard</h2>
                                        <button
                                            onClick={() => setIsEditingCard(false)}
                                            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Question</label>
                                            <textarea
                                                rows={4}
                                                value={editedCard.question}
                                                onChange={(e) => setEditedCard(prev => ({ ...prev, question: e.target.value }))}
                                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 resize-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Answer</label>
                                            <textarea
                                                rows={4}
                                                value={editedCard.answer}
                                                onChange={(e) => setEditedCard(prev => ({ ...prev, answer: e.target.value }))}
                                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 resize-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setIsEditingCard(false)}
                                            className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-bold hover:bg-zinc-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleUpdateFlashcard}
                                            className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* View Study Plan Modal */}
            <AnimatePresence>
                {selectedPlan && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => {
                                setSelectedPlan(null);
                                setIsEditingPlan(false);
                            }}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                        >
                            {!isEditingPlan ? (
                                <div className="p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <h2 className="text-3xl font-bold">{selectedPlan.title}</h2>
                                        <button
                                            onClick={() => {
                                                setSelectedPlan(null);
                                                setIsEditingPlan(false);
                                            }}
                                            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="prose prose-sm max-w-none mb-8 p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                                        <Markdown>{selectedPlan.content}</Markdown>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setIsEditingPlan(true)}
                                            className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-bold hover:bg-zinc-50 transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={handleDeletePlan}
                                            className="flex-1 px-6 py-3 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedPlan(null);
                                                setIsEditingPlan(false);
                                            }}
                                            className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <h2 className="text-3xl font-bold">Edit Study Plan</h2>
                                        <button
                                            onClick={() => setIsEditingPlan(false)}
                                            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Title</label>
                                            <input
                                                type="text"
                                                value={editedPlan.title}
                                                onChange={(e) => setEditedPlan(prev => ({ ...prev, title: e.target.value }))}
                                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Content</label>
                                            <textarea
                                                rows={10}
                                                value={editedPlan.content}
                                                onChange={(e) => setEditedPlan(prev => ({ ...prev, content: e.target.value }))}
                                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 resize-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setIsEditingPlan(false)}
                                            className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-bold hover:bg-zinc-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleUpdatePlan}
                                            className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* View Note Modal */}
            <AnimatePresence>
                {selectedNote && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedNote(null)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
                        >
                            {!isEditingNote ? (
                                <div className="p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex-1">
                                            <h2 className="text-3xl font-bold mb-2">{selectedNote.title}</h2>
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {selectedNote.tags.split(',').map(tag => (
                                                    <span key={tag} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold uppercase rounded-md">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedNote(null)}
                                            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="prose prose-sm max-w-none mb-6 p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                                        <Markdown>{selectedNote.content}</Markdown>
                                    </div>

                                    {selectedNote.summary && (
                                        <div className="mb-6">
                                            <h3 className="text-lg font-bold mb-3">Summary</h3>
                                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                                <Markdown>{selectedNote.summary}</Markdown>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setIsEditingNote(true);
                                                setEditedNote({
                                                    title: selectedNote.title,
                                                    content: selectedNote.content,
                                                    summary: selectedNote.summary || '',
                                                    tags: selectedNote.tags
                                                });
                                            }}
                                            className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-bold hover:bg-zinc-50 transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={handleDeleteNote}
                                            className="flex-1 px-6 py-3 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            onClick={() => setSelectedNote(null)}
                                            className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-8">
                                    <div className="flex justify-between items-start mb-6">
                                        <h2 className="text-3xl font-bold">Edit Note</h2>
                                        <button
                                            onClick={() => setIsEditingNote(false)}
                                            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="space-y-4 mb-8">
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Title</label>
                                            <input
                                                type="text"
                                                value={editedNote.title}
                                                onChange={(e) => setEditedNote(prev => ({ ...prev, title: e.target.value }))}
                                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Content</label>
                                            <textarea
                                                rows={6}
                                                value={editedNote.content}
                                                onChange={(e) => setEditedNote(prev => ({ ...prev, content: e.target.value }))}
                                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 resize-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Tags</label>
                                            <input
                                                type="text"
                                                value={editedNote.tags}
                                                onChange={(e) => setEditedNote(prev => ({ ...prev, tags: e.target.value }))}
                                                placeholder="Comma-separated tags"
                                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Summary</label>
                                            <textarea
                                                rows={4}
                                                value={editedNote.summary}
                                                onChange={(e) => setEditedNote(prev => ({ ...prev, summary: e.target.value }))}
                                                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 resize-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setIsEditingNote(false)}
                                            className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-bold hover:bg-zinc-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleUpdateNote}
                                            className="flex-1 px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Add Note Modal */}
            <AnimatePresence>
                {isAddingNote && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !isAnalyzing && setIsAddingNote(false)}
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-8">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-2xl font-bold">Add New Note</h3>
                                    <button
                                        onClick={() => !isAnalyzing && setIsAddingNote(false)}
                                        className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Title</label>
                                        <input
                                            type="text"
                                            value={newNote.title}
                                            onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
                                            placeholder="e.g., Introduction to Quantum Mechanics"
                                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Content</label>
                                        <textarea
                                            rows={8}
                                            value={newNote.content}
                                            onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                                            placeholder="Paste your lecture notes, scribbles, or PDF text here..."
                                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/5 resize-none"
                                        />
                                    </div>
                                </div>

                                <div className="mt-8 flex gap-3">
                                    <button
                                        onClick={() => setIsAddingNote(false)}
                                        disabled={isAnalyzing}
                                        className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-bold hover:bg-zinc-50 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddNote}
                                        disabled={isAnalyzing || !newNote.title || !newNote.content}
                                        className="flex-2 bg-black text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                AI is analyzing...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={18} />
                                                Analyze & Save
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
        </div>
    );
}
