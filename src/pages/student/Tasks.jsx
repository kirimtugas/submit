import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { BookOpen, Calendar, Clock, CheckCircle, AlertCircle, Send, FileText } from 'lucide-react';

export default function Tasks() {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(null);
    const [submissionText, setSubmissionText] = useState('');

    useEffect(() => {
        loadData();
    }, [currentUser]);

    const loadData = async () => {
        if (!currentUser) return;

        setLoading(true);
        try {
            // Get user class
            const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
            if (userDoc.empty) return;

            const userData = userDoc.docs[0].data();
            const classId = userData.classId;

            // Get tasks
            const tasksQuery = query(
                collection(db, 'tasks'),
                where('assignedClasses', 'array-contains', classId)
            );
            const tasksSnap = await getDocs(tasksQuery);
            setTasks(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Get submissions
            const submissionsQuery = query(
                collection(db, 'submissions'),
                where('studentId', '==', currentUser.uid)
            );
            const submissionsSnap = await getDocs(submissionsQuery);
            const subs = {};
            submissionsSnap.forEach(doc => {
                subs[doc.data().taskId] = doc.data();
            });
            setSubmissions(subs);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (taskId) => {
        if (!submissionText.trim()) {
            alert('Mohon isi jawaban tugas');
            return;
        }

        setSubmitting(taskId);
        try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
            const userData = userDoc.docs[0].data();

            await addDoc(collection(db, 'submissions'), {
                taskId,
                studentId: currentUser.uid,
                studentName: userData.name,
                content: submissionText,
                submittedAt: serverTimestamp(),
                grade: null,
                teacherComment: ''
            });

            alert('Tugas berhasil dikumpulkan!');
            setSubmissionText('');
            setSubmitting(null);
            loadData();
        } catch (error) {
            console.error('Error submitting task:', error);
            alert('Gagal mengumpulkan tugas');
        } finally {
            setSubmitting(null);
        }
    };

    const getTaskStatus = (task) => {
        const submission = submissions[task.id];
        const isOverdue = new Date(task.deadline) < new Date();

        if (submission) {
            if (submission.grade !== null && submission.grade !== undefined) {
                return { label: 'Dinilai', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle };
            }
            return { label: 'Sudah Dikumpulkan', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: CheckCircle };
        } else if (isOverdue) {
            return { label: 'Terlambat', color: 'bg-red-50 text-red-600 border-red-100', icon: AlertCircle };
        }
        return { label: 'Belum Dikumpulkan', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: Clock };
    };

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                    Tugas Saya
                </h1>
                <p className="text-slate-500 mt-1">Kerjakan dan kumpulkan tugas tepat waktu.</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : tasks.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl shadow-lg border border-slate-100">
                    <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <BookOpen className="h-10 w-10 text-blue-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Belum ada tugas</h3>
                    <p className="text-slate-500">Saat ini belum ada tugas yang diberikan oleh guru.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {tasks.map((task, index) => {
                        const status = getTaskStatus(task);
                        const submission = submissions[task.id];
                        const isOverdue = new Date(task.deadline) < new Date();
                        const isSubmitting = submitting === task.id;

                        return (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white p-6 md:p-8 rounded-3xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow"
                            >
                                <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                                    <div className="flex-1">
                                        <div className="flex items-start gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
                                                <FileText className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-800 mb-2">{task.title}</h3>
                                                <div className="flex items-center gap-4 text-sm">
                                                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 ${isOverdue ? 'text-red-600' : 'text-slate-600'}`}>
                                                        <Calendar className="h-4 w-4" />
                                                        <span>Deadline: {new Date(task.deadline).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 pl-16">
                                            <p className="text-slate-600 leading-relaxed">{task.description}</p>
                                        </div>
                                    </div>
                                    <span className={`px-4 py-2 rounded-xl text-sm font-bold border flex items-center gap-2 ${status.color}`}>
                                        <status.icon className="h-4 w-4" />
                                        {status.label}
                                    </span>
                                </div>

                                <div className="pl-0 md:pl-16">
                                    {submission ? (
                                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                            <div className="flex items-center gap-2 mb-3">
                                                <CheckCircle className="h-5 w-5 text-green-500" />
                                                <p className="text-sm font-bold text-slate-700">Jawaban Anda</p>
                                            </div>
                                            <p className="text-slate-600 whitespace-pre-wrap mb-4 pl-7">{submission.content}</p>

                                            {submission.grade !== null && submission.grade !== undefined && (
                                                <div className="mt-4 pt-4 border-t border-slate-200 pl-7">
                                                    <div className="flex items-center gap-4">
                                                        <div>
                                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Nilai</p>
                                                            <p className="text-3xl font-bold text-blue-600">{submission.grade}</p>
                                                        </div>
                                                        {submission.teacherComment && (
                                                            <div className="flex-1 border-l-2 border-slate-200 pl-4">
                                                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Komentar Guru</p>
                                                                <p className="text-sm text-slate-600 italic">"{submission.teacherComment}"</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : !isOverdue ? (
                                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                                Kumpulkan Tugas
                                            </label>
                                            <textarea
                                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-white"
                                                rows="4"
                                                placeholder="Tulis jawaban tugas Anda di sini..."
                                                value={submitting === task.id ? submissionText : ''}
                                                onChange={(e) => {
                                                    setSubmitting(task.id);
                                                    setSubmissionText(e.target.value);
                                                }}
                                            />
                                            <div className="flex justify-end mt-4">
                                                <button
                                                    onClick={() => handleSubmit(task.id)}
                                                    disabled={submitting === task.id && !submissionText.trim()}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-blue-200 flex items-center gap-2 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Send className="h-4 w-4" />
                                                    Kumpulkan Tugas
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-red-50 rounded-2xl p-4 border border-red-100 flex items-center gap-3 text-red-600">
                                            <AlertCircle className="h-5 w-5" />
                                            <p className="font-medium">Maaf, batas waktu pengumpulan tugas sudah berakhir.</p>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
