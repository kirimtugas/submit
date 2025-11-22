import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, X, Users as UsersIcon, Edit2, BookOpen, TrendingUp, Award, GraduationCap, BarChart3, Calendar, MapPin, Star, Users } from 'lucide-react';
import ClassDetail from './ClassDetail';
import { useAuth } from '../../contexts/AuthContext';

export default function Classes() {
    const { currentUser } = useAuth();
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [formData, setFormData] = useState({ name: '', subject: '' });
    const [classStats, setClassStats] = useState({});
    const [hoveredCard, setHoveredCard] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (currentUser) {
            loadClasses();
        }
    }, [currentUser]);

    const loadClasses = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'classes'),
                where('createdBy', '==', currentUser.uid)
            );
            const snapshot = await getDocs(q);
            const classesList = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setClasses(classesList);

            // Load stats for each class
            const stats = {};
            for (const cls of classesList) {
                // Count students
                const studentsSnap = await getDocs(
                    query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', cls.id))
                );

                // Count tasks
                const tasksSnap = await getDocs(
                    query(collection(db, 'tasks'), where('assignedClasses', 'array-contains', cls.id))
                );

                // Calculate average grade for this class
                const submissions = await getDocs(
                    query(collection(db, 'submissions'))
                );

                let totalGrade = 0;
                let gradedCount = 0;

                submissions.forEach(subDoc => {
                    const sub = subDoc.data();
                    if (sub.grade !== null && sub.grade !== undefined) {
                        // Check if student is in this class
                        studentsSnap.forEach(studentDoc => {
                            if (studentDoc.data().uid === sub.studentId) {
                                totalGrade += sub.grade;
                                gradedCount++;
                            }
                        });
                    }
                });

                stats[cls.id] = {
                    studentCount: studentsSnap.size,
                    taskCount: tasksSnap.size,
                    avgGrade: gradedCount > 0 ? (totalGrade / gradedCount).toFixed(1) : 0
                };
            }
            setClassStats(stats);
        } catch (error) {
            console.error('Error loading classes:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (cls = null) => {
        if (cls) {
            setEditingClass(cls);
            setFormData({ name: cls.name, subject: cls.subject || '' });
        } else {
            setEditingClass(null);
            setFormData({ name: '', subject: '' });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.subject.trim()) return;

        setLoading(true);
        try {
            if (editingClass) {
                await updateDoc(doc(db, 'classes', editingClass.id), {
                    name: formData.name,
                    subject: formData.subject,
                    updatedAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'classes'), {
                    name: formData.name,
                    subject: formData.subject,
                    createdBy: currentUser.uid,
                    createdAt: serverTimestamp()
                });
            }
            setFormData({ name: '', subject: '' });
            setShowModal(false);
            setEditingClass(null);
            loadClasses();
        } catch (error) {
            console.error('Error saving class:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Hapus kelas ini? Semua data terkait akan hilang.')) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, 'classes', id));
            loadClasses();
        } catch (error) {
            console.error('Error deleting class:', error);
        } finally {
            setLoading(false);
        }
    };

    const totalStudents = Object.values(classStats).reduce((sum, stat) => sum + stat.studentCount, 0);
    const totalTasks = Object.values(classStats).reduce((sum, stat) => sum + stat.taskCount, 0);
    const overallAvg = classes.length > 0
        ? (Object.values(classStats).reduce((sum, stat) => sum + parseFloat(stat.avgGrade || 0), 0) / classes.length).toFixed(1)
        : 0;

    const stats = [
        { label: 'Total Kelas', value: classes.length, icon: Users, color: 'from-blue-500 to-cyan-500' },
        { label: 'Total Siswa', value: totalStudents, icon: GraduationCap, color: 'from-sky-500 to-indigo-500' },
        { label: 'Total Tugas', value: totalTasks, icon: BookOpen, color: 'from-cyan-500 to-teal-500' },
        { label: 'Rata-rata Nilai', value: overallAvg, icon: Star, color: 'from-indigo-500 to-purple-500' },
    ];

    if (selectedClass) {
        return <ClassDetail classData={selectedClass} classes={classes} onBack={() => setSelectedClass(null)} />;
    }

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                        Manajemen Kelas
                    </h1>
                    <p className="text-slate-500 mt-1">Kelola kelas dan siswa Anda dengan mudah</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 transition-all"
                >
                    <Plus className="h-5 w-5" />
                    Tambah Kelas
                </motion.button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`bg-gradient-to-br ${stat.color} p-6 rounded-2xl text-white shadow-xl relative overflow-hidden group`}
                    >
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500"></div>
                        <div className="relative z-10">
                            <div className="bg-white/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4 backdrop-blur-sm">
                                <stat.icon className="h-6 w-6 text-white" />
                            </div>
                            <p className="text-white/80 text-sm font-medium">{stat.label}</p>
                            <h3 className="text-3xl font-bold mt-1">{stat.value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Classes Grid */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : classes.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Users className="h-10 w-10 text-blue-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Belum ada kelas</h3>
                    <p className="text-slate-500 mb-8 max-w-md mx-auto">Mulai dengan membuat kelas baru untuk mengelola siswa dan tugas Anda.</p>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                    >
                        Buat Kelas Pertama
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {classes.map((cls, index) => {
                        const stats = classStats[cls.id] || { studentCount: 0, taskCount: 0, avgGrade: 0 };
                        return (
                            <motion.div
                                key={cls.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.3 }}
                                className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-slate-200 group cursor-pointer"
                                onClick={() => setSelectedClass(cls)}
                            >
                                {/* Simplified Header */}
                                <div className="bg-slate-50 border-b border-slate-200 p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                                <UsersIcon className="h-6 w-6 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800">{cls.name}</h3>
                                                <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <BookOpen className="h-3 w-3" />
                                                    {cls.subject}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenModal(cls);
                                                }}
                                                className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-xl transition-all"
                                                title="Edit kelas"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(cls.id);
                                                }}
                                                className="text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-xl transition-all"
                                                title="Hapus kelas"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Content */}
                                <div className="p-6">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-1.5 mb-1">
                                                <Users className="h-4 w-4 text-blue-500" />
                                            </div>
                                            <div className="text-2xl font-bold text-slate-800">{stats.studentCount}</div>
                                            <div className="text-xs text-slate-500 font-medium">Siswa</div>
                                        </div>
                                        <div className="text-center border-x border-slate-100">
                                            <div className="flex items-center justify-center gap-1.5 mb-1">
                                                <BookOpen className="h-4 w-4 text-cyan-500" />
                                            </div>
                                            <div className="text-2xl font-bold text-slate-800">{stats.taskCount}</div>
                                            <div className="text-xs text-slate-500 font-medium">Tugas</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="flex items-center justify-center gap-1.5 mb-1">
                                                <Award className={`h-4 w-4 ${stats.avgGrade >= 80 ? 'text-green-500' : stats.avgGrade >= 60 ? 'text-amber-500' : 'text-slate-400'}`} />
                                            </div>
                                            <div className={`text-2xl font-bold ${stats.avgGrade >= 80 ? 'text-green-600' : stats.avgGrade >= 60 ? 'text-amber-600' : 'text-slate-800'}`}>
                                                {stats.avgGrade}
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium">Rata-rata</div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                        >
                            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold">
                                        {editingClass ? 'Edit Kelas' : 'Buat Kelas Baru'}
                                    </h2>
                                    <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                                <p className="text-blue-100 mt-1">Isi detail informasi kelas di bawah ini</p>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Nama Kelas</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Contoh: X IPA 1"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Mata Pelajaran</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Contoh: Matematika Wajib"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                        value={formData.subject}
                                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                    />
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-400 bg-white text-slate-800 font-bold hover:bg-slate-50 transition-all"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-xl hover:bg-blue-700 active:bg-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{ backgroundColor: loading ? undefined : '#2563eb' }}
                                    >
                                        {loading ? 'Menyimpan...' : (editingClass ? 'Simpan Perubahan' : 'Buat Kelas')}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div >
    );
}
