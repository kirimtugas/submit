import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Users, BookOpen, ClipboardList, AlertCircle, Calendar, CheckCircle } from 'lucide-react';

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
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const studentsSnap = await getDocs(
                query(collection(db, 'users'), where('role', '==', 'student'))
            );
            const classesSnap = await getDocs(collection(db, 'classes'));
            const tasksSnap = await getDocs(collection(db, 'tasks'));
            const activeTasks = tasksSnap.docs.filter(doc => {
                const deadline = doc.data().deadline;
                return deadline && new Date(deadline) > new Date();
            });
            const submissionsSnap = await getDocs(collection(db, 'submissions'));
            const needsGrading = submissionsSnap.docs.filter(doc => {
                const grade = doc.data().grade;
                return grade === null || grade === undefined;
            });

            const recentSubs = submissionsSnap.docs
                .filter(doc => doc.data().submittedAt)
                .sort((a, b) => b.data().submittedAt?.toMillis() - a.data().submittedAt?.toMillis())
                .slice(0, 5);

            const activities = await Promise.all(recentSubs.map(async (subDoc) => {
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
                const initial = studentName.charAt(0).toUpperCase();

                return {
                    id: subDoc.id,
                    studentName,
                    className,
                    taskTitle,
                    time: sub.submittedAt?.toDate(),
                    hasGrade: sub.grade !== null && sub.grade !== undefined,
                    grade: sub.grade,
                    initial
                };
            }));

            setStats({
                totalStudents: studentsSnap.size,
                totalClasses: classesSnap.size,
                activeTasks: activeTasks.length,
                needsGrading: needsGrading.length
            });
            setRecentActivities(activities);
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

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        Dashboard Guru
                    </h1>
                    <p className="text-slate-500 mt-1">Selamat datang kembali, {currentUser?.email}</p>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-blue-100">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium text-slate-600">
                        {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
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
                                            className="flex gap-4 p-4 rounded-xl hover:bg-blue-50/50 transition-colors border border-slate-100"
                                        >
                                            <div className={`w-12 h-12 rounded-xl ${activity.hasGrade ? 'bg-gradient-to-br from-green-500 to-emerald-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'} flex items-center justify-center flex-shrink-0 text-white font-bold text-lg shadow-md`}>
                                                {activity.initial}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold text-slate-800">
                                                            <span className="text-blue-600">{activity.studentName}</span> mengumpulkan tugas
                                                        </p>
                                                        <p className="text-sm text-slate-600 truncate font-medium">{activity.taskTitle}</p>
                                                        {activity.className && (
                                                            <p className="text-xs text-slate-500 mt-1">
                                                                <span className="bg-slate-100 px-2 py-0.5 rounded">Kelas: {activity.className}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        <p className="text-xs text-slate-400 whitespace-nowrap">{getTimeAgo(activity.time)}</p>
                                                        {activity.hasGrade ? (
                                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg font-semibold">
                                                                Nilai: {activity.grade}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-semibold">
                                                                Perlu Dinilai
                                                            </span>
                                                        )}
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
