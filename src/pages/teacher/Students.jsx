import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Trash2, Users, TrendingUp, Award, BookOpen, Filter, ChevronLeft, ChevronRight, ArrowUpDown, Edit2, X, Save, School, AlertTriangle } from 'lucide-react';

export default function Students() {
    const [students, setStudents] = useState([]);
    const [classesMap, setClassesMap] = useState({}); // id -> name mapping
    const [classesList, setClassesList] = useState([]); // full class objects for dropdown
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [studentStats, setStudentStats] = useState({});
    const [selectedClass, setSelectedClass] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [sortBy, setSortBy] = useState('name'); // name, class, grade
    const [sortOrder, setSortOrder] = useState('asc');
    const studentsPerPage = 20;

    // Modal States
    const [showModal, setShowModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [currentStudent, setCurrentStudent] = useState(null);
    const [studentToDelete, setStudentToDelete] = useState(null);
    const [formData, setFormData] = useState({ name: '', email: '', classId: '' });
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load classes
            const classesSnap = await getDocs(collection(db, 'classes'));
            const map = {};
            const list = [];
            classesSnap.forEach(doc => {
                const data = doc.data();
                map[doc.id] = data.name;
                list.push({ id: doc.id, ...data });
            });
            setClassesMap(map);
            setClassesList(list);

            // Load students
            const q = query(collection(db, 'users'), where('role', '==', 'student'));
            const snapshot = await getDocs(q);
            const studentsList = snapshot.docs.map(doc => ({
                id: doc.id,
                uid: doc.data().uid,
                ...doc.data()
            }));
            setStudents(studentsList);

            // Load stats for each student
            const stats = {};
            const submissionsSnap = await getDocs(collection(db, 'submissions'));
            const tasksSnap = await getDocs(collection(db, 'tasks'));
            const allSubmissions = submissionsSnap.docs.map(d => d.data());
            const allTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            for (const student of studentsList) {
                const studentClassId = student.classId;
                const classTasks = allTasks.filter(t =>
                    t.assignedClasses?.includes(studentClassId)
                );

                // Match submissions using either uid or id (for backward compatibility)
                const studentSubmissions = allSubmissions.filter(sub =>
                    sub.studentId === student.uid || sub.studentId === student.id
                );

                const gradedSubmissions = studentSubmissions.filter(sub =>
                    sub.grade !== null && sub.grade !== undefined
                );

                const totalGrade = gradedSubmissions.reduce((sum, sub) => sum + (sub.grade || 0), 0);
                const avgGrade = gradedSubmissions.length > 0 ? (totalGrade / gradedSubmissions.length).toFixed(1) : 0;

                stats[student.id] = {
                    totalTasks: classTasks.length,
                    submitted: studentSubmissions.length,
                    graded: gradedSubmissions.length,
                    avgGrade: parseFloat(avgGrade),
                    completionRate: classTasks.length > 0 ? ((studentSubmissions.length / classTasks.length) * 100).toFixed(0) : 0
                };
            }
            setStudentStats(stats);
        } catch (error) {
            console.error('Error loading students:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (student) => {
        setFormData({
            name: student.name || '',
            email: student.email || '',
            classId: student.classId || ''
        });
        setCurrentStudent(student);
        setShowModal(true);
    };

    const getTaskBadgeColor = (completed, total) => {
        if (total === 0) return 'bg-slate-100 text-slate-600 border-slate-200';
        if (completed === 0) return 'bg-red-50 text-red-600 border-red-200';
        const rate = completed / total;
        if (rate >= 0.8) return 'bg-green-50 text-green-600 border-green-200';
        return 'bg-amber-50 text-amber-600 border-amber-200';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (currentStudent) {
                await updateDoc(doc(db, 'users', currentStudent.id), {
                    name: formData.name,
                    email: formData.email,
                    classId: formData.classId,
                    updatedAt: serverTimestamp()
                });

                // Update local state
                setStudents(students.map(s =>
                    s.id === currentStudent.id
                        ? { ...s, ...formData }
                        : s
                ));
            }
            setShowModal(false);
        } catch (error) {
            console.error("Error saving student:", error);
            alert("Gagal menyimpan data siswa.");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = (student) => {
        setStudentToDelete(student);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!studentToDelete) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, 'users', studentToDelete.id));
            setStudents(students.filter(s => s.id !== studentToDelete.id));
            setShowDeleteModal(false);
            setStudentToDelete(null);
        } catch (error) {
            console.error('Error deleting student:', error);
            alert('Gagal menghapus siswa');
        } finally {
            setDeleting(false);
        }
    };

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    // Filter and sort students
    let filteredStudents = students.filter(student => {
        const matchesSearch = student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            classesMap[student.classId]?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesClass = selectedClass === 'all' || student.classId === selectedClass;

        return matchesSearch && matchesClass;
    });

    // Sort students
    filteredStudents.sort((a, b) => {
        let aVal, bVal;

        switch (sortBy) {
            case 'name':
                aVal = a.name?.toLowerCase() || '';
                bVal = b.name?.toLowerCase() || '';
                break;
            case 'class':
                aVal = classesMap[a.classId]?.toLowerCase() || '';
                bVal = classesMap[b.classId]?.toLowerCase() || '';
                break;
            case 'grade':
                aVal = studentStats[a.id]?.avgGrade || 0;
                bVal = studentStats[b.id]?.avgGrade || 0;
                break;
            default:
                return 0;
        }

        if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });

    // Pagination
    const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
    const startIndex = (currentPage - 1) * studentsPerPage;
    const endIndex = startIndex + studentsPerPage;
    const currentStudents = filteredStudents.slice(startIndex, endIndex);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedClass, sortBy, sortOrder]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                        Daftar Siswa
                    </h1>
                    <p className="text-slate-500 mt-1">Kelola siswa dan lihat performa mereka</p>
                </div>
                <div className="flex items-center gap-2 text-slate-600 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
                    <Users className="h-5 w-5 text-blue-500" />
                    <span className="font-semibold">{filteredStudents.length} dari {students.length} Siswa</span>
                </div>
            </div>

            {/* Summary Stats */}
            {!loading && students.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                                <Users className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium">Total Siswa</p>
                                <p className="text-2xl font-bold text-slate-800">{students.length}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-cyan-50 rounded-xl flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-cyan-600" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium">Rata-rata Kelas</p>
                                <p className="text-2xl font-bold text-slate-800">
                                    {students.length > 0
                                        ? (Object.values(studentStats).reduce((sum, s) => sum + parseFloat(s.avgGrade || 0), 0) / students.length).toFixed(1)
                                        : 0
                                    }
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center">
                                <BookOpen className="h-6 w-6 text-sky-600" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium">Tugas Dikumpulkan</p>
                                <p className="text-2xl font-bold text-slate-800">
                                    {Object.values(studentStats).reduce((sum, s) => sum + s.submitted, 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                                <Award className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-medium">Sudah Dinilai</p>
                                <p className="text-2xl font-bold text-slate-800">
                                    {Object.values(studentStats).reduce((sum, s) => sum + s.graded, 0)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                {/* Filters Bar */}
                <div className="p-6 border-b border-slate-100 bg-white">
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cari siswa berdasarkan nama atau email..."
                                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all bg-slate-50 focus:bg-white"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Class Filter */}
                        <div className="relative min-w-[200px]">
                            <Filter className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                            <select
                                className="w-full pl-12 pr-10 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-slate-50 focus:bg-white cursor-pointer transition-all"
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                            >
                                <option value="all">Semua Kelas</option>
                                {Object.entries(classesMap).map(([id, name]) => (
                                    <option key={id} value={id}>{name}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                <ChevronRight className="h-4 w-4 text-slate-400 rotate-90" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="p-12 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-slate-500">Memuat data siswa...</p>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="h-8 w-8 text-slate-300" />
                        </div>
                        <p>{searchTerm || selectedClass !== 'all' ? 'Tidak ada siswa yang cocok dengan filter.' : 'Belum ada siswa terdaftar.'}</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50/50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">
                                            No
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => handleSort('name')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Nama & Email
                                                <ArrowUpDown className="h-3 w-3" />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => handleSort('class')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Kelas
                                                <ArrowUpDown className="h-3 w-3" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            Tugas
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            Sudah Dinilai
                                        </th>
                                        <th
                                            className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                                            onClick={() => handleSort('grade')}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                Rata-rata
                                                <ArrowUpDown className="h-3 w-3" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-32">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {currentStudents.map((student, index) => {
                                        const stats = studentStats[student.id] || {
                                            totalTasks: 0,
                                            submitted: 0,
                                            graded: 0,
                                            avgGrade: 0,
                                            completionRate: 0
                                        };
                                        const globalIndex = startIndex + index + 1;

                                        return (
                                            <motion.tr
                                                key={student.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.02 }}
                                                className="hover:bg-blue-50/30 transition-colors group"
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                    {globalIndex}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                                                            {student.name?.[0]?.toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-bold text-slate-800 truncate group-hover:text-blue-700 transition-colors">{student.name}</div>
                                                            <div className="text-xs text-slate-500 truncate">{student.email}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                                        {classesMap[student.classId] || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getTaskBadgeColor(stats.submitted, stats.totalTasks)}`}>
                                                        <BookOpen className="h-3 w-3" />
                                                        <span className="text-sm font-medium">
                                                            {stats.submitted}/{stats.totalTasks}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <Award className={`h-4 w-4 ${stats.graded === stats.submitted && stats.submitted > 0 ? 'text-green-500' : 'text-amber-500'}`} />
                                                        <span className={`text-sm font-medium ${stats.graded === stats.submitted && stats.submitted > 0 ? 'text-green-600' : 'text-slate-700'}`}>
                                                            {stats.graded}<span className="text-slate-400">/</span>{stats.submitted}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <Award className={`h-4 w-4 ${stats.avgGrade >= 80 ? 'text-emerald-500' :
                                                            stats.avgGrade >= 60 ? 'text-amber-500' :
                                                                'text-red-500'
                                                            }`} />
                                                        <span className={`text-sm font-bold ${stats.avgGrade >= 80 ? 'text-emerald-600' :
                                                            stats.avgGrade >= 60 ? 'text-amber-600' :
                                                                'text-red-600'
                                                            }`}>
                                                            {stats.avgGrade}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
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
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="text-sm text-slate-500">
                                    Menampilkan <span className="font-bold text-slate-800">{startIndex + 1}</span> - <span className="font-bold text-slate-800">{Math.min(endIndex, filteredStudents.length)}</span> dari <span className="font-bold text-slate-800">{filteredStudents.length}</span> siswa
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium text-slate-600"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Prev
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }

                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => setCurrentPage(pageNum)}
                                                    className={`w-10 h-10 rounded-xl transition-all font-medium text-sm ${currentPage === pageNum
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                                        : 'text-slate-600 hover:bg-white hover:shadow-sm'
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium text-slate-600"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
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
                                            {classesList.map((cls) => (
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

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="h-8 w-8 text-red-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus Siswa?</h3>
                                <p className="text-slate-500 mb-6">
                                    Apakah Anda yakin ingin menghapus siswa <span className="font-bold text-slate-800">{studentToDelete?.name || 'ini'}</span>? Tindakan ini tidak dapat dibatalkan.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowDeleteModal(false)}
                                        className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        disabled={deleting}
                                        className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold shadow-lg hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {deleting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                Menghapus...
                                            </>
                                        ) : (
                                            <>
                                                <Trash2 className="h-5 w-5" />
                                                Hapus
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
