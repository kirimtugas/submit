import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query, where } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, GraduationCap, Calendar, Clock, FileText, AlertCircle, CheckCircle2, Eye, Users, Search, Filter, ArrowUpDown } from 'lucide-react';
import TaskDetail from './TaskDetail';

import { useAuth } from '../../contexts/AuthContext';

export default function Tasks() {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [classes, setClasses] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedTask, setSelectedTask] = useState(null);
    const [showClassModal, setShowClassModal] = useState(false);
    const [selectedTaskClasses, setSelectedTaskClasses] = useState([]);
    const [classStats, setClassStats] = useState({});
    // Filter and sort states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        deadline: '',
        assignedClasses: []
    });

    useEffect(() => {
        if (currentUser) {
            loadData();
        }
    }, [currentUser]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load classes created by this teacher
            const classesQuery = query(
                collection(db, 'classes'),
                where('createdBy', '==', currentUser.uid)
            );
            const classesSnap = await getDocs(classesQuery);
            setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Load tasks created by this teacher
            const q = query(
                collection(db, 'tasks'),
                where('createdBy', '==', currentUser.uid)
            );
            const tasksSnap = await getDocs(q);
            setTasks(tasksSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0))
            );
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadClassStats = async (classList) => {
        try {
            const stats = {};
            for (const cls of classList) {
                // Count students in this class
                const studentsSnap = await getDocs(
                    query(collection(db, 'users'), where('role', '==', 'student'), where('classId', '==', cls.id))
                );
                stats[cls.id] = {
                    studentCount: studentsSnap.size
                };
            }
            setClassStats(stats);
        } catch (error) {
            console.error('Error loading class stats:', error);
        }
    };

    const handleOpenModal = (task = null) => {
        if (task) {
            setEditingTask(task);
            setFormData({
                title: task.title,
                description: task.description,
                deadline: task.deadline,
                assignedClasses: task.assignedClasses || []
            });
        } else {
            setEditingTask(null);
            setFormData({ title: '', description: '', deadline: '', assignedClasses: [] });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.deadline || formData.assignedClasses.length === 0) {
            alert('Mohon lengkapi semua data tugas');
            return;
        }

        setLoading(true);
        try {
            if (editingTask) {
                await updateDoc(doc(db, 'tasks', editingTask.id), {
                    ...formData,
                    updatedAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'tasks'), {
                    ...formData,
                    createdBy: currentUser.uid,
                    createdAt: serverTimestamp()
                });
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            console.error('Error saving task:', error);
            alert('Gagal menyimpan tugas');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, title) => {
        if (!confirm(`Hapus tugas "${title}"?`)) return;

        try {
            await deleteDoc(doc(db, 'tasks', id));
            setTasks(tasks.filter(t => t.id !== id));
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('Gagal menghapus tugas');
        }
    };

    const toggleClassSelection = (classId) => {
        setFormData(prev => ({
            ...prev,
            assignedClasses: prev.assignedClasses.includes(classId)
                ? prev.assignedClasses.filter(id => id !== classId)
                : [...prev.assignedClasses, classId]
        }));
    };

    const isOverdue = (deadline) => {
        return new Date(deadline) < new Date();
    };

    const formatDeadline = (deadline) => {
        const date = new Date(deadline);
        return date.toLocaleString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Filter and sort logic
    const getFilteredAndSortedTasks = () => {
        let filtered = tasks;

        // Search filter
        if (searchQuery) {
            filtered = filtered.filter(t =>
                t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.description?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Status filter
        if (filterStatus === 'active') {
            filtered = filtered.filter(t => !isOverdue(t.deadline));
        } else if (filterStatus === 'overdue') {
            filtered = filtered.filter(t => isOverdue(t.deadline));
        }

        // Class filter
        if (filterClass !== 'all') {
            filtered = filtered.filter(t => t.assignedClasses?.includes(filterClass));
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'oldest':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'deadline-soon':
                    return new Date(a.deadline) - new Date(b.deadline);
                case 'deadline-late':
                    return new Date(b.deadline) - new Date(a.deadline);
                case 'title':
                    return a.title.localeCompare(b.title);
                default: // newest
                    return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

        return sorted;
    };

    const displayTasks = getFilteredAndSortedTasks();

    // Show TaskDetail if a task is selected
    if (selectedTask) {
        return <TaskDetail task={selectedTask} onBack={() => setSelectedTask(null)} />;
    }

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                        Manajemen Tugas
                    </h1>
                    <p className="text-slate-500 mt-1">Buat dan kelola tugas untuk siswa Anda</p>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleOpenModal()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-blue-200 flex items-center gap-2 transition-all"
                >
                    <Plus className="h-5 w-5" />
                    Buat Tugas
                </motion.button>
            </div>

            {/* Filter and Sort Controls */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari tugas..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm appearance-none bg-white cursor-pointer"
                        >
                            <option value="all">Semua Status</option>
                            <option value="active">Aktif</option>
                            <option value="overdue">Terlambat</option>
                        </select>
                    </div>

                    {/* Class Filter */}
                    <div className="relative">
                        <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select
                            value={filterClass}
                            onChange={(e) => setFilterClass(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm appearance-none bg-white cursor-pointer"
                        >
                            <option value="all">Semua Kelas</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Sort */}
                    <div className="relative">
                        <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm appearance-none bg-white cursor-pointer"
                        >
                            <option value="newest">Terbaru</option>
                            <option value="oldest">Terlama</option>
                            <option value="deadline-soon">Deadline Terdekat</option>
                            <option value="deadline-late">Deadline Terjauh</option>
                            <option value="title">Judul A-Z</option>
                        </select>
                    </div>
                </div>

                {/* Active Filters Display */}
                {(searchQuery || filterStatus !== 'all' || filterClass !== 'all' || sortBy !== 'newest') && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <span className="text-xs text-slate-500">Filter aktif:</span>
                        {searchQuery && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-lg">
                                "{searchQuery}"
                            </span>
                        )}
                        {filterStatus !== 'all' && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-lg">
                                {filterStatus === 'active' ? 'Aktif' : 'Terlambat'}
                            </span>
                        )}
                        {filterClass !== 'all' && (
                            <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded-lg">
                                {classes.find(c => c.id === filterClass)?.name}
                            </span>
                        )}
                        <button
                            onClick={() => {
                                setSearchQuery('');
                                setFilterStatus('all');
                                setFilterClass('all');
                                setSortBy('newest');
                            }}
                            className="ml-auto text-xs text-slate-500 hover:text-red-600 transition-colors"
                        >
                            Reset Filter
                        </button>
                    </div>
                )}
            </div>

            {/* Tasks List */}
            <div className="space-y-4">
                {loading && tasks.length === 0 ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : displayTasks.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <FileText className="h-10 w-10 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Tidak ada tugas ditemukan</h3>
                        <p className="text-slate-500 mb-8 max-w-md mx-auto">
                            {searchQuery || filterStatus !== 'all' || filterClass !== 'all'
                                ? 'Coba ubah filter atau kata kunci pencarian Anda.'
                                : 'Mulai dengan membuat tugas baru untuk kelas Anda.'}
                        </p>
                        {!searchQuery && filterStatus === 'all' && filterClass === 'all' && (
                            <button
                                onClick={() => handleOpenModal()}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
                            >
                                Buat Tugas Pertama
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {displayTasks.map((task, index) => (
                            <motion.div
                                key={task.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-all border border-slate-100 group"
                            >
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-600 transition-colors mb-2">{task.title}</h3>

                                        <p className="text-slate-600 mb-4 line-clamp-2">{task.description}</p>

                                        <div className="flex flex-wrap gap-3 text-sm">
                                            {/* Deadline with inline status badge */}
                                            <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg">
                                                <div className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${isOverdue(task.deadline)
                                                    ? 'bg-red-100 text-red-700'
                                                    : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                    {isOverdue(task.deadline) ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                                                    {isOverdue(task.deadline) ? 'Terlambat' : 'Aktif'}
                                                </div>
                                                <Calendar className="h-4 w-4 text-blue-500" />
                                                <span className="font-medium">
                                                    {formatDeadline(task.deadline)}
                                                </span>
                                            </div>

                                            {/* Assigned Classes Badge */}
                                            <button
                                                onClick={async () => {
                                                    const taskClasses = classes.filter(c => task.assignedClasses?.includes(c.id));
                                                    setSelectedTaskClasses(taskClasses);
                                                    setShowClassModal(true);
                                                    await loadClassStats(taskClasses);
                                                }}
                                                className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
                                            >
                                                <GraduationCap className="h-4 w-4 text-blue-500" />
                                                <span>
                                                    {task.assignedClasses?.length || 0} Kelas
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                                        <button
                                            onClick={() => setSelectedTask(task)}
                                            className="text-green-600 bg-green-50 hover:bg-green-100 p-2 rounded-xl transition-all"
                                            title="Lihat detail"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleOpenModal(task)}
                                            className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-xl transition-all"
                                            title="Edit tugas"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(task.id, task.title)}
                                            className="text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-xl transition-all"
                                            title="Hapus tugas"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Task Create/Edit Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
                        >
                            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white shrink-0">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold">
                                        {editingTask ? 'Edit Tugas' : 'Buat Tugas Baru'}
                                    </h2>
                                    <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white transition-colors">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                                <p className="text-blue-100 mt-1">Isi detail tugas untuk siswa Anda</p>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar">
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Judul Tugas <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                            placeholder="Contoh: Latihan Soal Aljabar"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Deskripsi
                                        </label>
                                        <textarea
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white min-h-[120px]"
                                            placeholder="Jelaskan detail tugas..."
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Tenggat Waktu <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="datetime-local"
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                            value={formData.deadline}
                                            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Tugaskan ke Kelas <span className="text-red-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                            {classes.map(cls => (
                                                <label
                                                    key={cls.id}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${formData.assignedClasses.includes(cls.id)
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                                                        }`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formData.assignedClasses.includes(cls.id)
                                                        ? 'border-blue-500 bg-blue-500 text-white'
                                                        : 'border-slate-300 bg-white'
                                                        }`}>
                                                        {formData.assignedClasses.includes(cls.id) && <CheckCircle2 className="h-3 w-3" />}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={formData.assignedClasses.includes(cls.id)}
                                                        onChange={() => toggleClassSelection(cls.id)}
                                                    />
                                                    <span className="font-medium">{cls.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                        {classes.length === 0 && (
                                            <div className="text-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 mt-2">
                                                <p className="text-sm text-slate-500">Belum ada kelas. Buat kelas terlebih dahulu di menu Kelas.</p>
                                            </div>
                                        )}
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
                                            {loading ? 'Menyimpan...' : (editingTask ? 'Simpan Perubahan' : 'Buat Tugas')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Class Info Modal */}
            <AnimatePresence>
                {showClassModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
                        >
                            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 text-white shrink-0">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-2xl font-bold">Kelas Ditugaskan</h2>
                                    <button onClick={() => setShowClassModal(false)} className="text-white/80 hover:text-white transition-colors">
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                                <p className="text-blue-100 mt-1">Daftar kelas yang ditugaskan untuk tugas ini</p>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar">
                                {selectedTaskClasses.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <GraduationCap className="h-8 w-8 text-slate-400" />
                                        </div>
                                        <p className="text-slate-500">Tidak ada kelas yang ditugaskan</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedTaskClasses.map((cls, index) => (
                                            <motion.div
                                                key={cls.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 hover:shadow-md transition-all"
                                            >
                                                <div className="bg-blue-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg">
                                                    {cls.name.charAt(0)}
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-slate-800">{cls.name}</h3>
                                                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                                                        <Users className="h-4 w-4" />
                                                        <span>{classStats[cls.id]?.studentCount || 0} Siswa</span>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
