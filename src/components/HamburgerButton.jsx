import { Menu, X } from 'lucide-react';

export default function HamburgerButton({ isOpen, onClick }) {
    return (
        <button
            onClick={onClick}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
        >
            {isOpen ? (
                <X className="h-6 w-6 text-slate-700" />
            ) : (
                <Menu className="h-6 w-6 text-slate-700" />
            )}
        </button>
    );
}
