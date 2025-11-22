import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Users,
    BookOpen,
    ClipboardList,
    GraduationCap,
    Menu,
    X
} from 'lucide-react';
import { useState, useEffect } from 'react';
import ProfileDropdown from '../components/ProfileDropdown';

export default function DashboardLayout({ children }) {
    const { currentUser, logout, userRole } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile screen size
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            // Auto-open sidebar on desktop, closed on mobile
            setSidebarOpen(!mobile);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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

    // Close sidebar on navigation (mobile only)
    const handleNavClick = () => {
        if (isMobile) {
            setSidebarOpen(false);
        }
    };

    return (
        <div className="flex h-screen bg-sky-50 overflow-hidden">
            {/* Overlay for mobile */}
            <AnimatePresence>
                {sidebarOpen && isMobile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                initial={false}
                animate={{
                    x: sidebarOpen ? 0 : -300
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className={`fixed left-0 top-0 h-full bg-white border-r border-blue-100 text-slate-600 w-64 shadow-2xl flex flex-col z-50`}
            >
                <div className="p-6 flex-1 overflow-y-auto">
                    <h1 className="text-2xl font-bold mb-8 tracking-tight text-blue-600">
                        STMS <span className="font-light opacity-70 text-slate-400">{userRole === 'teacher' ? 'Teacher' : 'Student'}</span>
                    </h1>

                    <nav className="space-y-2">
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/teacher' || item.path === '/student'}
                                onClick={handleNavClick}
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

                {/* Credits Section */}
                <div className="px-3 py-2 border-t border-slate-100">
                    <div className="text-center space-y-0.5">
                        <p className="text-xs text-slate-400 font-light leading-tight">
                            Made with <span className="text-red-400">❤️</span> by <span className="font-normal text-slate-500">Mr. Tio</span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-light leading-tight">
                            Powered by Google Antigravity & Firebase
                        </p>
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <div
                className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen && !isMobile ? 'lg:ml-64' : 'ml-0'
                    }`}
            >
                {/* Header */}
                <header className="bg-white/80 backdrop-blur-md border-b border-blue-100 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-30 flex-shrink-0">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors text-slate-600"
                        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                    >
                        {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>

                    <ProfileDropdown currentUser={currentUser} logout={logout} />
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {children || <Outlet />}
                </main>
            </div>
        </div>
    );
}
