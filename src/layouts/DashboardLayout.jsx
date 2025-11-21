import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    Users,
    BookOpen,
    ClipboardList,
    GraduationCap,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import { useState } from 'react';

export default function DashboardLayout({ children }) {
    const { currentUser, logout, userRole } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const teacherMenuItems = [
        { path: '/teacher', icon: LayoutDashboard, label: 'Ringkasan' },
        { path: '/teacher/classes', icon: Users, label: 'Kelas' },
        { path: '/teacher/students', icon: GraduationCap, label: 'Siswa' },
        { path: '/teacher/tasks', icon: BookOpen, label: 'Tugas' },
        { path: '/teacher/gradebook', icon: ClipboardList, label: 'Rekap Nilai' },
    ];

    const studentMenuItems = [
        { path: '/student', icon: LayoutDashboard, label: 'Ringkasan' },
        { path: '/student/tasks', icon: BookOpen, label: 'Tugas Saya' },
        { path: '/student/grades', icon: ClipboardList, label: 'Nilai Saya' },
    ];

    const menuItems = userRole === 'teacher' ? teacherMenuItems : studentMenuItems;
    const title = userRole === 'teacher' ? 'STMS Teacher' : 'STMS Student';

    return (
        <div className="flex h-screen bg-sky-50">
            {/* Sidebar */}
            <motion.aside
                initial={{ x: -300 }}
                animate={{ x: sidebarOpen ? 0 : -300 }}
                className="fixed left-0 top-0 h-full bg-white border-r border-blue-100 text-slate-600 w-64 shadow-2xl z-50 flex flex-col"
            >
                <div className="p-6 flex-1">
                    <h1 className="text-2xl font-bold mb-8 tracking-tight text-blue-600">STMS <span className="font-light opacity-70 text-slate-400">{userRole === 'teacher' ? 'Teacher' : 'Student'}</span></h1>

                    <nav className="space-y-2">
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/teacher' || item.path === '/student'}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                        ? 'bg-blue-50 text-blue-600 shadow-sm font-semibold'
                                        : 'text-slate-500 hover:bg-blue-50/50 hover:text-blue-700'
                                    }`
                                }
                            >
                                <item.icon className="h-5 w-5" />
                                <span className="font-medium">{item.label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </div>

                {/* Logout Button - Bottom of Sidebar */}
                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={logout}
                        className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 hover:text-red-700 transition-all w-full font-semibold border border-red-200/50 hover:border-red-300"
                    >
                        <LogOut className="h-5 w-5" />
                        <span>Keluar</span>
                    </button>
                </div>
            </motion.aside>

            {/* Main Content */}
            <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
                {/* Header */}
                <header className="bg-white/80 backdrop-blur-md border-b border-blue-100 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-slate-600"
                    >
                        {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Selamat datang</p>
                            <p className="font-semibold text-slate-800">{currentUser?.email}</p>
                        </div>
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold shadow-md shadow-blue-200">
                            {currentUser?.email?.[0].toUpperCase()}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="p-6">
                    {children || <Outlet />}
                </main>
            </div>
        </div>
    );
}

