import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle, Clock, AlertCircle, Calendar } from 'lucide-react';

export default function Overview() {
    const { currentUser } = useAuth();
    const [stats, setStats] = useState({
        totalTasks: 0,
        completed: 0,
        pending: 0,
        overdue: 0
    });
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [currentUser]);

    const loadData = async () => {
        if (!currentUser) return;

        setLoading(true);
        try {
            // Get user data to find classId
            const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', currentUser.uid)));
            if (userDoc.empty) return;

            const userData = userDoc.docs[0].data();
            const classId = userData.classId;

            // Get tasks for this class
            const tasksQuery = query(
                collection(db, 'tasks'),
                where('assignedClasses', 'array-contains', classId)
            );
            const tasksSnap = await getDocs(tasksQuery);
            const tasksList = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTasks(tasksList);

            // Get submissions
            const submissionsQuery = query(
                collection(db, 'submissions'),
                where('studentId', '==', currentUser.uid)
            );
            const submissionsSnap = await getDocs(submissionsQuery);
            const submissions = {};
            submissionsSnap.forEach(doc => {
                submissions[doc.data().taskId] = doc.data();
            });

            // Calculate stats
            let completed = 0;
            let pending = 0;
            let overdue = 0;

            tasksList.forEach(task => {
                const submission = submissions[task.id];
                const isOverdue = new Date(task.deadline) < new Date();

                if (submission) {
                    completed++;
                } else if (isOverdue) {
                    overdue++;
                } else {
                    pending++;
                }
            });

            setStats({
                totalTasks: tasksList.length,
                completed,
                pending,
                overdue
            });
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        { label: 'Total Tugas', value: stats.totalTasks, icon: BookOpen, color: 'from-blue-500 to-cyan-500' },
        { label: 'Selesai', value: stats.completed, icon: CheckCircle, color: 'from-emerald-500 to-teal-500' },
        { label: 'Belum Selesai', value: stats.pending, icon: Clock, color: 'from-amber-500 to-orange-500' },
        { label: 'Terlambat', value: stats.overdue, icon: AlertCircle, color: 'from-red-500 to-pink-500' },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-600">
                    Dashboard Siswa
                </h1>
                <p className="text-slate-500 mt-1">Selamat datang, lihat progress belajarmu hari ini.</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {statCards.map((card, index) => (
                            <motion.div
                                key={card.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={`bg-gradient-to-br ${card.color} p-6 rounded-2xl shadow-lg text-white relative overflow-hidden group`}
                            >
                                <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-500"></div>

                                <div className="relative z-10 flex items-center justify-between">
                                    <div>
                                        <p className="text-white/80 text-sm font-medium mb-1">{card.label}</p>
                                        <p className="text-4xl font-bold">{card.value}</p>
                                    </div>
                                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                                        <card.icon className="h-8 w-8 text-white" />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-blue-500" />
                                    Tugas Terbaru
                                </h3>
                            </div>

                            <div className="p-6">
                                {tasks.length === 0 ? (
                                    <div className="text-center py-8 text-slate-500">
                                        <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <BookOpen className="h-8 w-8 text-blue-300" />
                                        </div>
                                        <p>Belum ada tugas yang diberikan.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {tasks.slice(0, 5).map((task, index) => (
                                            <motion.div
                                                key={task.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-blue-50 transition-colors border border-slate-100"
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                                                        <BookOpen className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{task.title}</h4>
                                                        <p className="text-sm text-slate-500 line-clamp-1">{task.description}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right pl-4">
                                                    <div className={`flex items-center gap-1 text-sm font-medium ${new Date(task.deadline) < new Date() ? 'text-red-500' : 'text-emerald-500'}`}>
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-1">Deadline</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Motivation / Quick Stats */}
                        <div className="bg-gradient-to-br from-blue-900 to-slate-900 rounded-3xl shadow-lg text-white p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -ml-16 -mb-16"></div>

                            <div className="relative z-10 h-full flex flex-col justify-between">
                                <div>
                                    <h3 className="text-xl font-bold mb-2">Tetap Semangat! 🚀</h3>
                                    <p className="text-blue-100 text-sm">Selesaikan tugas tepat waktu untuk mendapatkan nilai terbaik.</p>
                                </div>

                                <div className="mt-8 space-y-4">
                                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                                        <div className="flex justify-between items-end mb-2">
                                            <p className="text-blue-100 text-sm">Progress Mingguan</p>
                                            <p className="text-2xl font-bold text-cyan-400">75%</p>
                                        </div>
                                        <div className="w-full bg-slate-700/50 rounded-full h-2">
                                            <div className="bg-gradient-to-r from-blue-400 to-cyan-400 h-2 rounded-full" style={{ width: '75%' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
