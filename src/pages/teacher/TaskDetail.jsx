import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, CheckCircle2, Clock, XCircle, Award, FileText, Calendar, BookOpen, Save, X, Edit2 } from 'lucide-react';

export default function TaskDetail({ task, onBack }) {
    const [students, setStudents] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [showGradeModal, setShowGradeModal] = useState(false);
    const [currentSubmission, setCurrentSubmission] = useState(null);
    const [gradeData, setGradeData] = useState({ grade: '', feedback: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Validate task object
    if (!task) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-red-800 mb-2">Error: Task Not Found</h2>
                    <p className="text-red-600 mb-4">Task data is missing or undefined.</p>
                    <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
                        Back to Tasks
                    </button>
                </div>
            </div>
        );
    }

    // Add error boundary
    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Task Detail</h2>
                    <p className="text-red-600 mb-4">{error.message}</p>
                    <pre className="text-xs bg-white p-4 rounded overflow-auto max-h-64">{error.stack}</pre>
                    <button onClick={onBack} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
                        Back to Tasks
                    </button>
                </div>
            </div>
        );
    }

    useEffect(() => {
        try {
            loadSubmissions();
        } catch (err) {
            console.error('Error in useEffect:', err);
            setError(err);
        }
    }, [task.id]);

    const loadSubmissions = async () => {
        setLoading(true);
        try {
            // Check if task has assigned classes
            if (!task.assignedClasses || task.assignedClasses.length === 0) {
                setStudents([]);
                setSubmissions({});
                setLoading(false);
                return;
            }

            // Get all students from assigned classes
            const studentsQuery = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('classId', 'in', task.assignedClasses)
            );
            const studentsSnap = await getDocs(studentsQuery);
            const studentsList = studentsSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setStudents(studentsList);

            // Get all submissions for this task
            const submissionsQuery = query(
                collection(db, 'submissions'),
                where('taskId', '==', task.id)
            );
            const submissionsSnap = await getDocs(submissionsQuery);
            const submissionsMap = {};
            submissionsSnap.docs.forEach(doc => {
                const data = doc.data();
                submissionsMap[data.studentId] = {
                    id: doc.id,
                    ...data
                };
            });

            setSubmissions(submissionsMap);
        } catch (error) {
            console.error('Error loading submissions:', error);
            // Set empty data on error to prevent blank page
            setStudents([]);
            setSubmissions({});
        } finally {
            setLoading(false);
        }
    };

    const handleGradeClick = (student) => {
        const submission = submissions[student.uid] || submissions[student.id];
        setCurrentSubmission({ student, submission });
        setGradeData({
            grade: submission?.grade?.toString() || '',
            feedback: submission?.feedback || ''
        });
        setShowGradeModal(true);
    };

    const handleSaveGrade = async () => {
        if (!currentSubmission?.submission) {
            alert('Siswa belum mengumpulkan tugas');
            return;
        }

        const grade = parseFloat(gradeData.grade);
        if (isNaN(grade) || grade < 0 || grade > 100) {
            alert('Nilai harus antara 0-100');
            return;
        }

        setSaving(true);
        try {
            await updateDoc(doc(db, 'submissions', currentSubmission.submission.id), {
                grade: grade,
                feedback: gradeData.feedback,
                gradedAt: serverTimestamp()
            });

            // Update local state
            setSubmissions(prev => ({
                ...prev,
                [currentSubmission.student.uid || currentSubmission.student.id]: {
                    ...prev[currentSubmission.student.uid || currentSubmission.student.id],
                    grade: grade,
                    feedback: gradeData.feedback
                }
            }));

            setShowGradeModal(false);
        } catch (error) {
            console.error('Error saving grade:', error);
            alert('Gagal menyimpan nilai: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const getSubmissionStatus = (student) => {
        // Try both uid and id as fallback
        const submission = submissions[student.uid] || submissions[student.id];
        if (!submission) {
            return { status: 'not_submitted', label: 'Belum Submit', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
        }

        const isLate = new Date(submission.submittedAt?.toDate?.() || submission.submittedAt) > new Date(task.deadline);
        if (isLate) {
            return { status: 'late', label: 'Terlambat', color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300' };
        }

        return { status: 'submitted', label: 'Sudah Submit', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300' };
    };

    const formatDate = (date) => {
        if (!date) return '-';
        try {
            const d = date.toDate ? date.toDate() : new Date(date);
            if (isNaN(d.getTime())) return 'Invalid Date';
            return d.toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            console.error("Error formatting date:", date, e);
            return 'Invalid Date';
        }
    };

    // Calculate statistics
    const stats = {
        total: students.length,
        submitted: Object.keys(submissions).length,
        graded: Object.values(submissions).filter(s => s.grade !== undefined && s.grade !== null).length,
        avgGrade: Object.values(submissions).filter(s => s.grade !== undefined && s.grade !== null).length > 0
            ? (Object.values(submissions).filter(s => s.grade !== undefined && s.grade !== null).reduce((sum, s) => sum + s.grade, 0) /
                Object.values(submissions).filter(s => s.grade !== undefined && s.grade !== null).length).toFixed(1)
            : 0
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-800">{task?.title || 'Loading...'}</h1>
                    <p className="text-slate-500 text-sm mt-1">{task?.description || ''}</p>
                </div>
            </div>

            {/* Task Info */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">Deadline: {task?.deadline ? formatDate(task.deadline) : '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                        <BookOpen className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">{task?.assignedClasses?.length || 0} Kelas</span>
                    </div>
                </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                            <Users className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Total Siswa</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Sudah Submit</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.submitted}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center">
                            <Award className="h-6 w-6 text-cyan-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Sudah Dinilai</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.graded}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                            <Award className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Rata-rata</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.avgGrade}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Submissions Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : students.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Tidak ada siswa</h3>
                        <p className="text-slate-500">Belum ada siswa di kelas yang ditugaskan.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">No</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Siswa</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Waktu Submit</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Nilai</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-32">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {students.map((student, index) => {
                                    const submission = submissions[student.uid] || submissions[student.id];
                                    const statusInfo = getSubmissionStatus(student);

                                    return (
                                        <motion.tr
                                            key={student.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: index * 0.03 }}
                                            className="hover:bg-blue-50/30 transition-colors group"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                                                        {student.name?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                                                            {student.name || 'Tanpa Nama'}
                                                        </div>
                                                        <div className="text-xs text-slate-500">{student.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.bgColor} ${statusInfo.color} ${statusInfo.borderColor}`}>
                                                    {statusInfo.status === 'submitted' && <CheckCircle2 className="h-3 w-3" />}
                                                    {statusInfo.status === 'late' && <Clock className="h-3 w-3" />}
                                                    {statusInfo.status === 'not_submitted' && <XCircle className="h-3 w-3" />}
                                                    {statusInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm text-slate-600">
                                                {submission ? formatDate(submission.submittedAt) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {submission?.grade !== undefined && submission?.grade !== null ? (
                                                    <div className={`inline-flex items-center gap-1.5 font-bold ${submission.grade >= 80 ? 'text-green-600' :
                                                        submission.grade >= 60 ? 'text-amber-600' :
                                                            'text-red-600'
                                                        }`}>
                                                        <Award className="h-4 w-4" />
                                                        {submission.grade}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => handleGradeClick(student)}
                                                    disabled={!submission}
                                                    className={`p-2 rounded-xl transition-all ${submission
                                                        ? (submission?.grade !== undefined && submission?.grade !== null
                                                            ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                                            : 'text-purple-600 bg-purple-50 hover:bg-purple-100')
                                                        : 'text-slate-400 bg-slate-50 cursor-not-allowed'
                                                        }`}
                                                    title={submission?.grade !== undefined && submission?.grade !== null ? 'Edit nilai' : 'Beri nilai'}
                                                >
                                                    {submission?.grade !== undefined && submission?.grade !== null ? (
                                                        <Edit2 className="h-4 w-4" />
                                                    ) : (
                                                        <Award className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Grading Modal */}
            <AnimatePresence>
                {showGradeModal && currentSubmission && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
                        >
                            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold">Penilaian Tugas</h2>
                                    <p className="text-blue-100 text-sm mt-1">{currentSubmission.student.name}</p>
                                </div>
                                <button onClick={() => setShowGradeModal(false)} className="text-white/80 hover:text-white transition-colors">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Submission Info */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                                        <FileText className="h-4 w-4 text-blue-500" />
                                        <span className="font-semibold">Informasi Pengumpulan</span>
                                    </div>
                                    <div className="space-y-1 text-sm">
                                        <p className="text-slate-600">
                                            <span className="font-medium">Waktu Submit:</span> {formatDate(currentSubmission.submission?.submittedAt)}
                                        </p>
                                        {currentSubmission.submission?.fileUrl && (
                                            <p className="text-slate-600">
                                                <span className="font-medium">File:</span>{' '}
                                                <a
                                                    href={currentSubmission.submission.fileUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline"
                                                >
                                                    Lihat File
                                                </a>
                                            </p>
                                        )}
                                        {currentSubmission.submission?.answer && (
                                            <div className="mt-2">
                                                <p className="font-medium text-slate-700 mb-1">Jawaban:</p>
                                                <div className="bg-white p-3 rounded-lg border border-slate-200 text-slate-600 max-h-32 overflow-y-auto">
                                                    {currentSubmission.submission.answer}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Grade Input */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Nilai (0-100) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                        placeholder="Masukkan nilai"
                                        value={gradeData.grade}
                                        onChange={(e) => setGradeData({ ...gradeData, grade: e.target.value })}
                                    />
                                </div>

                                {/* Feedback Input */}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Feedback (Opsional)
                                    </label>
                                    <textarea
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white min-h-[100px]"
                                        placeholder="Berikan komentar atau saran untuk siswa..."
                                        value={gradeData.feedback}
                                        onChange={(e) => setGradeData({ ...gradeData, feedback: e.target.value })}
                                    />
                                </div>

                                {/* Actions */}
                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowGradeModal(false)}
                                        className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={handleSaveGrade}
                                        disabled={saving}
                                        className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {saving ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Menyimpan...
                                            </>
                                        ) : (
                                            <>
                                                <Save className="h-5 w-5" />
                                                Simpan Nilai
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
