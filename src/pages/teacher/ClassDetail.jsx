import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Filter, MoreVertical, Mail, Plus, Edit2, Trash2, X, Save, UserPlus, BookOpen, Award, CheckCircle, Lock, School } from 'lucide-react';

export default function ClassDetail({ classData, classes, onBack }) {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [currentStudent, setCurrentStudent] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', classId: '' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadClassData();
    }, [classData.id]);

    const loadClassData = async () => {
        setLoading(true);
        try {
            // 1. Get all students in this class
            const studentsQuery = query(
                collection(db, 'users'),
                where('role', '==', 'student'),
                where('classId', '==', classData.id)
            );
            const studentsSnap = await getDocs(studentsQuery);

            // 2. Get task stats
            const tasksQuery = query(
                collection(db, 'tasks'),
                where('assignedClasses', 'array-contains', classData.id)
            );
            const tasksSnap = await getDocs(tasksQuery);
            const totalTasks = tasksSnap.size;
            const taskIds = tasksSnap.docs.map(d => d.id);

            // 3. Get submissions
            const submissionsSnap = await getDocs(collection(db, 'submissions'));
            const allSubmissions = submissionsSnap.docs.map(d => d.data());

            const studentsList = studentsSnap.docs.map(doc => {
                const student = { id: doc.id, ...doc.data() };

                const studentSubmissions = allSubmissions.filter(sub =>
                    sub.studentId === student.uid && taskIds.includes(sub.taskId)
                );

                const completedCount = studentSubmissions.length;
                const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

                const gradedSubmissions = studentSubmissions.filter(sub => sub.grade !== undefined && sub.grade !== null);
                const totalGrade = gradedSubmissions.reduce((sum, sub) => sum + sub.grade, 0);
                const avgGrade = gradedSubmissions.length > 0 ? (totalGrade / gradedSubmissions.length).toFixed(1) : 0;

                return {
                    ...student,
                    stats: {
                        completionRate,
                        avgGrade,
                        completedCount,
                        totalTasks,
                        gradedCount: gradedSubmissions.length
                    }
                };
            });

            setStudents(studentsList);
        } catch (error) {
            console.error("Error loading class details:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (student) => {
        setFormData({
            name: student.name || '',
            email: student.email || '',
            classId: student.classId || classData.id
        });
        setCurrentStudent(student);
        setShowModal(true);
    };

    const handleDeleteClick = async (student) => {
        if (!confirm(`Apakah Anda yakin ingin menghapus siswa ${student.name}?`)) return;

        try {
            await deleteDoc(doc(db, 'users', student.id));
            loadClassData(); // Reload data
        } catch (error) {
            console.error("Error deleting student:", error);
            alert("Gagal menghapus siswa.");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (currentStudent) {
                // Update existing student
                await updateDoc(doc(db, 'users', currentStudent.id), {
                    name: formData.name,
                    email: formData.email,
                    classId: formData.classId,
                    updatedAt: serverTimestamp()
                });
            }
            setShowModal(false);
            loadClassData();
        } catch (error) {
            console.error("Error saving student:", error);
            alert("Gagal menyimpan data siswa.");
        } finally {
            setSaving(false);
        }
    };

    const filteredStudents = students.filter(student => {
        return student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.email?.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const getTaskBadgeColor = (completed, total) => {
        if (total === 0) return 'bg-slate-100 text-slate-600 border-slate-200';
        if (completed === 0) return 'bg-red-50 text-red-600 border-red-200';
        const rate = completed / total;
        if (rate >= 0.8) return 'bg-green-50 text-green-600 border-green-200';
        return 'bg-amber-50 text-amber-600 border-amber-200';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">{classData.name}</h1>
                        <p className="text-slate-500 text-sm flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            {classData.subject}
                        </p>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Cari siswa..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-slate-50 focus:bg-white transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-sm text-slate-500 font-medium">
                    Total: <span className="text-slate-800 font-bold">{filteredStudents.length}</span> Siswa
                </div>
            </div>

            {/* Table View */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">Tidak ada siswa</h3>
                        <p className="text-slate-500">Belum ada siswa di kelas ini atau tidak ditemukan.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50/50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">No</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Siswa</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Tugas</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Nilai Rata2</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStudents.map((student, index) => (
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
                                                    {student.name ? student.name.charAt(0).toUpperCase() : '?'}
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
                                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getTaskBadgeColor(student.stats.completedCount, student.stats.totalTasks)}`}>
                                                <BookOpen className="h-3 w-3" />
                                                <span className="text-sm font-medium">
                                                    {student.stats.completedCount}/{student.stats.totalTasks}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className={`inline-flex items-center gap-1.5 font-bold ${student.stats.avgGrade >= 80 ? 'text-green-600' :
                                                student.stats.avgGrade >= 60 ? 'text-amber-600' : 'text-slate-600'
                                                }`}>
                                                <Award className="h-4 w-4" />
                                                {student.stats.avgGrade}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handleEditClick(student)}
                                                    className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-xl transition-all"
                                                    title="Edit siswa"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(student)}
                                                    className="text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-xl transition-all"
                                                    title="Hapus siswa"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
                        >
                            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white flex justify-between items-center">
                                <h2 className="text-xl font-bold">Edit Data Siswa</h2>
                                <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Lengkap</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Nama Siswa"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="email@sekolah.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Kelas</label>
                                    <div className="relative">
                                        <School className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                        <select
                                            required
                                            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white appearance-none cursor-pointer"
                                            value={formData.classId}
                                            onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                                        >
                                            {classes?.map((cls) => (
                                                <option key={cls.id} value={cls.id}>
                                                    {cls.name}{cls.subject ? ` - ${cls.subject}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
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
                                                Simpan
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
