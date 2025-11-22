import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Search, TrendingUp, Users, FileText, Target, CheckCircle, Clock, AlertCircle, ArrowUpDown } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';

export default function Gradebook() {
    const { currentUser } = useAuth();
    const [students, setStudents] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('all');
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState('number');
    const [sortOrder, setSortOrder] = useState('asc');

    useEffect(() => {
        if (currentUser) {
            loadData();
        }
    }, [currentUser]);

    useEffect(() => {
        if (students.length > 0 && !selectedStudent) {
            setSelectedStudent(students[0]);
        }
    }, [students]);

    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Load Classes created by this teacher
            const classesQuery = query(
                collection(db, 'classes'),
                where('createdBy', '==', currentUser.uid)
            );
            const classesSnap = await getDocs(classesQuery);
            const teacherClassIds = classesSnap.docs.map(doc => doc.id);
            setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // 2. Load Students in these classes
            let studentsList = [];
            if (teacherClassIds.length > 0) {
                const allStudentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
                const allStudentsSnap = await getDocs(allStudentsQuery);

                studentsList = allStudentsSnap.docs
                    .filter(doc => teacherClassIds.includes(doc.data().classId))
                    .map(doc => {
                        const data = doc.data();
                        const studentId = data.uid || doc.id;
                        return {
                            id: doc.id,
                            ...data,
                            uid: studentId
                        };
                    });
            }

            // 3. Load Tasks created by this teacher
            const tasksQuery = query(
                collection(db, 'tasks'),
                where('createdBy', '==', currentUser.uid)
            );
            const tasksSnap = await getDocs(tasksQuery);
            const teacherTaskIds = tasksSnap.docs.map(doc => doc.id);
            setTasks(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // 4. Load Submissions for these tasks
            let submissionsList = [];
            if (teacherTaskIds.length > 0) {
                const allSubmissionsSnap = await getDocs(collection(db, 'submissions'));
                submissionsList = allSubmissionsSnap.docs
                    .filter(doc => teacherTaskIds.includes(doc.data().taskId))
                    .map(doc => ({ id: doc.id, ...doc.data() }));
            }
            setSubmissions(submissionsList);

            const studentsWithLastSubmission = studentsList.map(student => {
                const studentSubs = submissionsList.filter(sub => sub.studentId === student.uid);
                const latestSub = studentSubs.sort((a, b) => b.submittedAt?.seconds - a.submittedAt?.seconds)[0];
                return {
                    ...student,
                    lastSubmission: latestSub?.submittedAt?.seconds || 0
                };
            });

            studentsWithLastSubmission.sort((a, b) => b.lastSubmission - a.lastSubmission);
            setStudents(studentsWithLastSubmission);

            // Tasks already loaded above
            // setTasks(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateClassStats = () => {
        const classStudents = selectedClass === 'all' ? students : students.filter(s => s.classId === selectedClass);
        const totalStudents = classStudents.length;

        const grades = classStudents.map(student => {
            const studentSubs = submissions.filter(sub => sub.studentId === student.uid && sub.grade);
            if (studentSubs.length === 0) return 0;
            return studentSubs.reduce((sum, sub) => sum + parseFloat(sub.grade), 0) / studentSubs.length;
        }).filter(g => g > 0);

        const avgGrade = grades.length > 0 ? (grades.reduce((sum, g) => sum + g, 0) / grades.length).toFixed(1) : 0;
        const totalTasks = tasks.length;
        const completionRate = classStudents.length > 0 && totalTasks > 0
            ? ((submissions.filter(sub => classStudents.find(s => s.uid === sub.studentId)).length / (classStudents.length * totalTasks)) * 100).toFixed(0)
            : 0;

        return { avgGrade, totalStudents, totalTasks, completionRate };
    };

    const stats = calculateClassStats();

    const filteredStudents = students.filter(student => {
        const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesClass = selectedClass === 'all' || student.classId === selectedClass;
        return matchesSearch && matchesClass;
    });

    const getStudentStats = (student) => {
        const studentSubs = submissions.filter(sub => sub.studentId === student.uid);
        const gradedSubs = studentSubs.filter(sub => sub.grade);
        const avgGrade = gradedSubs.length > 0
            ? (gradedSubs.reduce((sum, sub) => sum + parseFloat(sub.grade), 0) / gradedSubs.length).toFixed(1)
            : 0;

        const studentClass = student.classId;
        const classTasks = tasks.filter(task => task.assignedClasses?.includes(studentClass));

        return {
            submitted: studentSubs.length,
            total: classTasks.length,
            avgGrade
        };
    };

    const getStudentTasks = () => {
        if (!selectedStudent) return [];

        const studentClass = selectedStudent.classId;
        const studentTasks = tasks.filter(task => task.assignedClasses?.includes(studentClass));

        return studentTasks.map(task => {
            const submission = submissions.find(sub =>
                sub.studentId === selectedStudent.uid && sub.taskId === task.id
            );

            const deadline = task.deadline ? new Date(task.deadline) : null;
            const now = new Date();
            const isOverdue = deadline && deadline < now && !submission;

            return {
                ...task,
                submission,
                isOverdue,
                status: submission?.grade ? 'graded' : submission ? 'submitted' : isOverdue ? 'overdue' : 'pending'
            };
        });
    };

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    let studentTasks = getStudentTasks();

    studentTasks = [...studentTasks].sort((a, b) => {
        let aVal, bVal;

        switch (sortBy) {
            case 'title':
                aVal = a.title.toLowerCase();
                bVal = b.title.toLowerCase();
                break;
            case 'deadline':
                aVal = a.deadline ? new Date(a.deadline).getTime() : 0;
                bVal = b.deadline ? new Date(b.deadline).getTime() : 0;
                break;
            case 'status':
                const statusOrder = { graded: 1, submitted: 2, pending: 3, overdue: 4 };
                aVal = statusOrder[a.status];
                bVal = statusOrder[b.status];
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

    const selectedStudentStats = selectedStudent ? getStudentStats(selectedStudent) : { submitted: 0, total: 0, avgGrade: 0 };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                    Rekap Nilai
                </h1>
                <p className="text-slate-500 mt-1">Pantau dan kelola nilai siswa Anda</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-cyan-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Rata-rata Nilai</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.avgGrade}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                            <Target className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Tingkat Penyelesaian</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.completionRate}%</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                            <Users className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Total Siswa</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.totalStudents}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                            <FileText className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-medium">Total Tugas</p>
                            <p className="text-2xl font-bold text-slate-800">{stats.totalTasks}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col" style={{ maxHeight: '700px' }}>
                    <div className="p-4 border-b border-slate-100 space-y-3 flex-shrink-0">
                        <h3 className="font-bold text-slate-800">Daftar Siswa</h3>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Cari Siswa"
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="relative">
                            <select
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm appearance-none cursor-pointer bg-white"
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                            >
                                <option value="all">Semua Kelas</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1">
                        {filteredStudents.map((student) => {
                            const isSelected = selectedStudent?.id === student.id;

                            return (
                                <div
                                    key={student.id}
                                    onClick={() => setSelectedStudent(student)}
                                    className={`p-3 border-b border-slate-100 cursor-pointer transition-all ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-slate-50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${isSelected ? 'bg-blue-600' : 'bg-purple-500'
                                            }`}>
                                            {student.name[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-semibold text-sm truncate ${isSelected ? 'text-blue-900' : 'text-slate-800'}`}>
                                                {student.name}
                                            </p>
                                            <p className="text-xs text-slate-500 truncate">{student.email}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    {selectedStudent ? (
                        <>
                            <div className="p-6 border-b border-slate-100">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h2 className="text-2xl font-bold text-slate-800 mb-1">{selectedStudent.name}</h2>
                                        <p className="text-sm text-slate-500">{selectedStudent.email}</p>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Kelas: {classes.find(c => c.id === selectedStudent.classId)?.name || '-'}
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3 text-center min-w-[100px]">
                                            <p className="text-xs text-cyan-600 font-medium mb-1">Rata-rata</p>
                                            <p className="text-2xl font-bold text-cyan-700">{selectedStudentStats.avgGrade}</p>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center min-w-[100px]">
                                            <p className="text-xs text-blue-600 font-medium mb-1">Tugas Selesai</p>
                                            <p className="text-2xl font-bold text-blue-700">{selectedStudentStats.submitted}/{selectedStudentStats.total}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-slate-800">Riwayat Tugas</h3>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-lg border border-green-200">
                                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                                            <span className="text-green-700 font-medium">Dinilai</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-50 rounded-lg border border-orange-200">
                                            <Clock className="h-3.5 w-3.5 text-orange-600" />
                                            <span className="text-orange-700 font-medium">Menunggu</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 rounded-lg border border-red-200">
                                            <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                                            <span className="text-red-700 font-medium">Terlambat</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200">
                                            <FileText className="h-3.5 w-3.5 text-slate-600" />
                                            <span className="text-slate-700 font-medium">Belum</span>
                                        </div>
                                    </div>
                                </div>
                                {studentTasks.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                                        <p>Tidak ada tugas untuk siswa ini</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-slate-50/50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">
                                                        No
                                                    </th>
                                                    <th
                                                        className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                                                        onClick={() => handleSort('title')}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            Judul Tugas
                                                            <ArrowUpDown className="h-3 w-3" />
                                                        </div>
                                                    </th>
                                                    <th
                                                        className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                                                        onClick={() => handleSort('deadline')}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            Deadline
                                                            <ArrowUpDown className="h-3 w-3" />
                                                        </div>
                                                    </th>
                                                    <th
                                                        className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors"
                                                        onClick={() => handleSort('status')}
                                                    >
                                                        <div className="flex items-center justify-center gap-2">
                                                            Status
                                                            <ArrowUpDown className="h-3 w-3" />
                                                        </div>
                                                    </th>
                                                    <th className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                        Nilai
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {studentTasks.map((task, index) => (
                                                    <tr key={task.id} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">
                                                            {index + 1}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="text-sm font-semibold text-slate-800">{task.title}</div>
                                                            <div className="text-xs text-slate-500 line-clamp-1">{task.description}</div>
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">
                                                            {task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap text-center">
                                                            {task.status === 'graded' && (
                                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                                                    <CheckCircle className="h-3 w-3" />
                                                                    Dinilai
                                                                </span>
                                                            )}
                                                            {task.status === 'submitted' && (
                                                                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    Menunggu
                                                                </span>
                                                            )}
                                                            {task.status === 'overdue' && (
                                                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                                                    <AlertCircle className="h-3 w-3" />
                                                                    Terlambat
                                                                </span>
                                                            )}
                                                            {task.status === 'pending' && (
                                                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold inline-flex items-center gap-1">
                                                                    <FileText className="h-3 w-3" />
                                                                    Belum
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-4 whitespace-nowrap text-center">
                                                            {task.submission?.grade ? (
                                                                <span className="text-lg font-bold text-green-600">
                                                                    {task.submission.grade}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-96 text-slate-500">
                            <div className="text-center">
                                <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                                <p>Pilih siswa untuk melihat detail nilai</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
