import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Download, Filter } from 'lucide-react';

export default function Gradebook() {
    const [students, setStudents] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState({});
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedTask, setSelectedTask] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadClasses();
    }, []);

    useEffect(() => {
        if (classes.length > 0 || selectedClass === '') {
            loadGradebook();
        }
    }, [selectedClass, selectedTask, classes]);

    const loadClasses = async () => {
        try {
            const classesSnap = await getDocs(collection(db, 'classes'));
            setClasses(classesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error('Error loading classes:', error);
        }
    };

    const loadGradebook = async () => {
        setLoading(true);
        try {
            // Load students
            let studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
            if (selectedClass) {
                studentsQuery = query(studentsQuery, where('classId', '==', selectedClass));
            }
            const studentsSnap = await getDocs(studentsQuery);
            const studentsList = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            studentsList.sort((a, b) => a.name.localeCompare(b.name));
            setStudents(studentsList);

            // Load tasks
            let tasksQuery = query(collection(db, 'tasks'), orderBy('deadline', 'asc'));
            if (selectedClass) {
                tasksQuery = query(collection(db, 'tasks'), where('assignedClasses', 'array-contains', selectedClass), orderBy('deadline', 'asc'));
            }
            const tasksSnap = await getDocs(tasksQuery);
            setTasks(tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

            // Load submissions
            const submissionsSnap = await getDocs(collection(db, 'submissions'));
            const submissionsMap = {};
            submissionsSnap.forEach(doc => {
                const data = doc.data();
                if (!submissionsMap[data.studentId]) {
                    submissionsMap[data.studentId] = {};
                }
                submissionsMap[data.studentId][data.taskId] = data;
            });
            setSubmissions(submissionsMap);
        } catch (error) {
            console.error('Error loading gradebook:', error);
        } finally {
            setLoading(false);
        }
    };

    const getClassNameById = (classId) => {
        const cls = classes.find(c => c.id === classId);
        return cls ? cls.name : '-';
    };

    const getCellContent = (studentId, task) => {
        const submission = submissions[studentId]?.[task.id];

        if (submission) {
            if (submission.grade !== null && submission.grade !== undefined) {
                return {
                    content: submission.grade,
                    style: 'font-bold text-purple-600',
                    tooltip: `Nilai: ${submission.grade}`
                };
            } else {
                return {
                    content: '⏳',
                    style: 'text-orange-500',
                    tooltip: 'Sudah dikumpulkan, belum dinilai'
                };
            }
        } else {
            // Check if overdue
            if (new Date(task.deadline) < new Date()) {
                return {
                    content: '❌',
                    style: 'text-red-500',
                    tooltip: 'Tidak dikumpulkan (terlambat)'
                };
            } else {
                return {
                    content: '-',
                    style: 'text-gray-400',
                    tooltip: 'Belum dikumpulkan'
                };
            }
        }
    };

    const exportToCSV = () => {
        if (students.length === 0) {
            alert('Tidak ada data untuk diexport');
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";

        // Header
        let header = ["Nama Siswa", "Kelas"];
        tasks.forEach(task => header.push(task.title));
        csvContent += header.map(h => `"${h}"`).join(",") + "\r\n";

        // Rows
        students.forEach(student => {
            let row = [`"${student.name}"`, `"${getClassNameById(student.classId)}"`];

            tasks.forEach(task => {
                const submission = submissions[student.id]?.[task.id];
                let value = '';
                if (submission && submission.grade !== null && submission.grade !== undefined) {
                    value = submission.grade;
                } else if (submission) {
                    value = 'Submitted';
                } else {
                    value = 'Missing';
                }
                row.push(value);
            });

            csvContent += row.join(",") + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `rekap_nilai_stms_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Rekap Nilai</h2>
                <div className="flex gap-3">
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-gray-600" />
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                            <option value="">Semua Kelas</option>
                            {classes.map(cls => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="h-5 w-5 text-gray-600" />
                        <select
                            value={selectedTask}
                            onChange={(e) => setSelectedTask(e.target.value)}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        >
                            <option value="">Semua Tugas</option>
                            {tasks.map(task => (
                                <option key={task.id} value={task.id}>{task.title}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={exportToCSV}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors"
                    >
                        <Download className="h-5 w-5" />
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                        <p className="mt-4">Memuat data...</p>
                    </div>
                ) : students.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        Tidak ada data siswa untuk ditampilkan.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 sticky left-0 bg-gray-50 z-10">
                                        Nama Siswa
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200">
                                        Kelas
                                    </th>
                                    {(selectedTask ? tasks.filter(t => t.id === selectedTask) : tasks).map(task => (
                                        <th
                                            key={task.id}
                                            className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 min-w-[120px]"
                                            title={task.title}
                                        >
                                            {task.title.length > 15 ? task.title.substring(0, 15) + '...' : task.title}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {students.map((student, index) => (
                                    <motion.tr
                                        key={student.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: index * 0.02 }}
                                        className="hover:bg-gray-50"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white">
                                            {student.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                                                {getClassNameById(student.classId)}
                                            </span>
                                        </td>
                                        {(selectedTask ? tasks.filter(t => t.id === selectedTask) : tasks).map(task => {
                                            const cell = getCellContent(student.id, task);
                                            return (
                                                <td
                                                    key={task.id}
                                                    className={`px-6 py-4 whitespace-nowrap text-sm text-center ${cell.style}`}
                                                    title={cell.tooltip}
                                                >
                                                    {cell.content}
                                                </td>
                                            );
                                        })}
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="mt-4 bg-white p-4 rounded-xl shadow">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Keterangan:</h3>
                <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-purple-600">Angka</span>
                        <span className="text-gray-600">= Sudah dinilai</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-orange-500">⏳</span>
                        <span className="text-gray-600">= Sudah dikumpulkan, belum dinilai</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-red-500">❌</span>
                        <span className="text-gray-600">= Tidak dikumpulkan (terlambat)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400">-</span>
                        <span className="text-gray-600">= Belum dikumpulkan</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
