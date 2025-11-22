import { useState, useEffect, useRef } from 'react';
import { LogOut, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfileDropdown({ currentUser, logout }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Profile Avatar Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 focus:outline-none"
            >
                <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Selamat datang</p>
                    <p className="font-semibold text-slate-800 truncate max-w-[200px]">{currentUser?.email}</p>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold shadow-md shadow-blue-200 flex-shrink-0 hover:shadow-lg transition-shadow cursor-pointer">
                    {currentUser?.email?.[0].toUpperCase()}
                </div>
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50"
                    >
                        {/* User Info */}
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md">
                                    {currentUser?.email?.[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-500 font-medium">Logged in as</p>
                                    <p className="font-semibold text-slate-800 truncate">{currentUser?.email}</p>
                                </div>
                            </div>
                        </div>

                        {/* Logout Button */}
                        <div className="p-2">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    logout();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors font-medium"
                            >
                                <LogOut className="h-5 w-5" />
                                <span>Keluar</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
