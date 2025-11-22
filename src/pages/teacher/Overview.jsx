import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Users, BookOpen, ClipboardList, AlertCircle, Calendar, CheckCircle, Clock, UserPlus, Plus } from 'lucide-react';

export default function TeacherOverview() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalClasses: 0,
        activeTasks: 0,
        needsGrading: 0
    });
    const [recentActivities, setRecentActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (currentUser) {
            loadData();
        }
    }, [currentUser]);

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

            // 2. Load Students in these classes
            let studentsSnap = { size: 0, docs: [] };
            if (teacherClassIds.length > 0) {
                const allStudentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
                const allStudentsSnap = await getDocs(allStudentsQuery);
                // Filter client-side for simplicity as 'in' query has limits
                const filteredStudents = allStudentsSnap.docs.filter(doc =>
                    teacherClassIds.includes(doc.data().classId)
                );
                studentsSnap = { size: filteredStudents.length, docs: filteredStudents };
            }
            // 3. Load Tasks created by this teacher
            const tasksQuery = query(
                collection(db, 'tasks'),
                where('createdBy', '==', currentUser.uid)
            );
            const tasksSnap = await getDocs(tasksQuery);
            const teacherTaskIds = tasksSnap.docs.map(doc => doc.id);
            const activeTasks = tasksSnap.docs.filter(doc => {
                const deadline = doc.data().deadline;
                return deadline && new Date(deadline) > new Date();
            });
            // 4. Load Submissions for these tasks
            let submissionsSnap = { docs: [] };
            if (teacherTaskIds.length > 0) {
                const allSubmissionsSnap = await getDocs(collection(db, 'submissions'));
                const filteredSubmissions = allSubmissionsSnap.docs.filter(doc =>
                    teacherTaskIds.includes(doc.data().taskId)
                );
                submissionsSnap = { docs: filteredSubmissions };
            }
            const needsGrading = submissionsSnap.docs.filter(doc => {
                const grade = doc.data().grade;
                return grade === null || grade === undefined;
            });

            // Helper to parse date from Firestore Timestamp or String
            const parseDate = (dateField) => {
                if (!dateField) return null;
                if (typeof dateField.toDate === 'function') return dateField.toDate();
                if (typeof dateField.toMillis === 'function') return new Date(dateField.toMillis());
                if (typeof dateField === 'string') return new Date(dateField);
                if (dateField instanceof Date) return dateField;
                return null;
            };

            // Collect all activities
            const allActivities = [];

            // 1. Submission Activities (always include these)
            const recentSubs = submissionsSnap.docs
                .filter(doc => doc.data().submittedAt)
                .sort((a, b) => {
                    const dateA = parseDate(a.data().submittedAt);
                    const dateB = parseDate(b.data().submittedAt);
                    return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
                });

            for (const subDoc of recentSubs) {
                const sub = subDoc.data();
                let studentName = 'Unknown Student';
                let className = '';

                const studentDocs = studentsSnap.docs.find(doc => doc.id === sub.studentId || doc.data().uid === sub.studentId);
                if (studentDocs) {
                    const studentData = studentDocs.data();
                    studentName = studentData.name || studentData.email?.split('@')[0] || 'Unknown Student';
                    if (studentData.classId) {
                        const classDoc = classesSnap.docs.find(c => c.id === studentData.classId);
                        className = classDoc?.data()?.name || '';
                    }
                }

                const taskDoc = tasksSnap.docs.find(t => t.id === sub.taskId);
                const taskTitle = taskDoc?.data()?.title || 'Unknown Task';

                allActivities.push({
                    id: subDoc.id,
                    type: 'submission',
                    timestamp: parseDate(sub.submittedAt),
                    taskId: sub.taskId,
                    studentName,
                    className,
                    taskTitle,
                    hasGrade: sub.grade !== null && sub.grade !== undefined,
                    grade: sub.grade,
                    initial: studentName.charAt(0).toUpperCase()
                });
            }

            // 2. New Student Activities (within 7 days)
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            studentsSnap.docs.forEach(doc => {
                const student = doc.data();
                const createdAt = parseDate(student.createdAt);

                if (createdAt && createdAt.getTime() > sevenDaysAgo) {
                    const classDoc = classesSnap.docs.find(c => c.id === student.classId);
                    const className = classDoc?.data()?.name || 'Unknown Class';

                    allActivities.push({
                        id: `student-${doc.id}`,
                        type: 'new_student',
                        timestamp: createdAt,
                        studentName: student.name || student.email?.split('@')[0] || 'Unknown Student',
                        className,
                        classId: student.classId,
                        initial: (student.name || 'U').charAt(0).toUpperCase()
                    });
                }
            });

            // 3. Deadline Reminder Activities (within 3 days)
            const now = new Date();
            const threeDaysLater = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
            tasksSnap.docs.forEach(doc => {
                const task = doc.data();
                const deadline = parseDate(task.deadline);

                if (deadline && deadline > now && deadline <= threeDaysLater) {
                    const daysUntil = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));

                    allActivities.push({
                        id: `deadline-${doc.id}`,
                        type: 'deadline',
                        timestamp: deadline,
                        taskTitle: task.title,
                        taskId: doc.id,
                        daysUntilDeadline: daysUntil,
                        initial: '⏰'
                    });
                }
            });

            // 4. New Task Activities (within 7 days)
            tasksSnap.docs.forEach(doc => {
                const task = doc.data();
                const createdAt = parseDate(task.createdAt);

                if (createdAt && createdAt.getTime() > sevenDaysAgo) {
                    allActivities.push({
                        id: `newtask-${doc.id}`,
                        type: 'new_task',
                        timestamp: createdAt,
                        taskTitle: task.title,
                        taskId: doc.id,
                        initial: '➕'
                    });
                }
            });

            // Sort all activities by timestamp (most recent first) and limit to 10
            const sortedActivities = allActivities
                .filter(activity => activity.timestamp) // Filter out activities without timestamp
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 10);

            setStats({
                totalStudents: studentsSnap.size,
                totalClasses: classesSnap.size,
                activeTasks: activeTasks.length,
                needsGrading: needsGrading.length
            });
            setRecentActivities(sortedActivities);
        } catch (error) {
            console.error('Error loading overview data:', error);
        } finally {
            setLoading(false);
        }
    };

    const statsCards = [
        { label: 'Total Siswa', value: stats.totalStudents, icon: Users, color: 'from-blue-500 to-cyan-500', path: '/teacher/students' },
        { label: 'Total Kelas', value: stats.totalClasses, icon: BookOpen, color: 'from-sky-500 to-indigo-500', path: '/teacher/classes' },
        { label: 'Tugas Aktif', value: stats.activeTasks, icon: ClipboardList, color: 'from-cyan-500 to-teal-500', path: '/teacher/tasks' },
        { label: 'Perlu Dinilai', value: stats.needsGrading, icon: AlertCircle, color: 'from-indigo-500 to-purple-500', path: '/teacher/gradebook' },
    ];

    const getTimeAgo = (date) => {
        if (!date) return '';
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Baru saja';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} menit yang lalu`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam yang lalu`;
        return `${Math.floor(seconds / 86400)} hari yang lalu`;
    };

    const handleActivityClick = (activity) => {
        switch (activity.type) {
            case 'submission':
            case 'deadline':
            case 'new_task':
                // Navigate to tasks page with the selected task ID
                navigate('/teacher/tasks', {
                    state: {
                        selectedTaskId: activity.taskId
                    }
                });
                break;
            case 'new_student':
                // Navigate to classes page with the selected class ID
                navigate('/teacher/classes', {
                    state: {
                        selectedClassId: activity.classId
                    }
                });
                break;
            default:
                break;
        }
    };

    const getActivityIcon = (activity) => {
        switch (activity.type) {
            case 'submission':
                return activity.hasGrade ? 'bg-gradient-to-br from-green-500 to-emerald-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500';
            case 'new_student':
                return 'bg-gradient-to-br from-purple-500 to-pink-500';
            case 'deadline':
                return 'bg-gradient-to-br from-orange-500 to-amber-500';
            case 'new_task':
                return 'bg-gradient-to-br from-cyan-500 to-teal-500';
            default:
                return 'bg-gradient-to-br from-slate-500 to-gray-500';
        }
    };

    const getActivityMessage = (activity) => {
        switch (activity.type) {
            case 'submission':
                return (
                    <>
                        <span className="text-blue-600">{activity.studentName}</span> mengumpulkan tugas
                    </>
                );
            case 'new_student':
                return (
                    <>
                        Siswa baru <span className="text-purple-600">{activity.studentName}</span> bergabung
                    </>
                );
            case 'deadline':
                return (
                    <>
                        Deadline tugas dalam <span className="text-orange-600">{activity.daysUntilDeadline} hari</span>
                    </>
                );
            case 'new_task':
                return (
                    <>
                        Tugas baru dibuat
                    </>
                );
            default:
                return 'Aktivitas';
        }
    };

    const getActivityBadge = (activity) => {
        switch (activity.type) {
            case 'submission':
                return activity.hasGrade ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-semibold">
                        Nilai: {activity.grade}
                    </span>
                ) : (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-semibold">
                        Perlu Dinilai
                    </span>
                );
            case 'new_student':
                return (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-semibold">
                        Siswa Baru
                    </span>
                );
            case 'deadline':
                return (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg font-semibold">
                        Mendesak
                    </span>
                );
            case 'new_task':
                return (
                    <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded-lg font-semibold">
                        Baru
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        Dashboard Guru
                    </h1>
                    <p className="text-slate-500 mt-1">Selamat datang kembali, {currentUser?.email}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-blue-100">
                        <Calendar className="h-5 w-5 text-blue-500" />
                        <span className="text-sm font-medium text-slate-600">
                            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {statsCards.map((stat, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                onClick={() => navigate(stat.path)}
                                className={`bg-gradient-to-br ${stat.color} p-6 rounded-2xl shadow-lg text-white relative overflow-hidden group cursor-pointer hover:scale-105 transition-transform`}
                            >
                                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl group-hover:scale-150 transition-transform duration-500"></div>
                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                            <stat.icon className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <h3 className="text-3xl font-bold mb-1">{stat.value}</h3>
                                    <p className="text-blue-50 font-medium text-sm opacity-90">{stat.label}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="bg-white rounded-3xl shadow-lg border border-blue-100 overflow-hidden">
                        <div className="p-6 border-b border-blue-50 bg-gradient-to-r from-white to-blue-50/30">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-blue-500" />
                                Aktivitas Terbaru
                            </h2>
                        </div>
                        <div className="p-6">
                            {recentActivities.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <p>Belum ada aktivitas terbaru</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {recentActivities.map((activity) => (
                                        <motion.div
                                            key={activity.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            onClick={() => handleActivityClick(activity)}
                                            className="flex gap-4 p-4 rounded-xl hover:bg-blue-50 transition-all border border-slate-100 cursor-pointer hover:shadow-md hover:border-blue-200"
                                        >
                                            <div className={`w-12 h-12 rounded-xl ${getActivityIcon(activity)} flex items-center justify-center flex-shrink-0 text-white font-bold text-lg shadow-md`}>
                                                {activity.initial}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-slate-800">
                                                            {getActivityMessage(activity)}
                                                        </p>
                                                        <p className="text-sm text-slate-600 truncate font-medium">{activity.taskTitle}</p>
                                                        {activity.className && (
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                <span className="bg-slate-100 px-2 py-0.5 rounded">Kelas: {activity.className}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <p className="text-xs text-slate-400 whitespace-nowrap">{getTimeAgo(activity.timestamp)}</p>
                                                        {getActivityBadge(activity)}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
