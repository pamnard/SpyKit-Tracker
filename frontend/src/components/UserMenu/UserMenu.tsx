import { useState, useRef, useEffect } from 'react';
import { Settings, LogOut, Moon, Sun, ChevronUp, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../../theme';
import { useAuth } from '../../context/AuthContext';

export const UserMenu = () => {
    const { user, logout } = useAuth();
    const { theme, toggle } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    if (!user) return null;

    return (
        <div className="relative" ref={menuRef}>
            {isOpen && (
                <div className="absolute bottom-full left-0 w-full mb-2 bg-surface border border-border rounded-md shadow-lg py-1 z-10 overflow-hidden">
                    <div className="px-4 py-2 border-b border-border mb-1">
                        <p className="text-sm font-medium text-text">My profile</p>
                        <p className="text-xs text-muted truncate">{user.username}</p>
                    </div>

                    <Link
                        to="/users"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-muted hover:text-text hover:bg-surface-muted transition-colors"
                        onClick={() => setIsOpen(false)}
                    >
                        <Users size={14} />
                        Users
                    </Link>

                    <Link
                        to="/settings"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-muted hover:text-text hover:bg-surface-muted transition-colors"
                        onClick={() => setIsOpen(false)}
                    >
                        <Settings size={14} />
                        Settings
                    </Link>

                    <button
                        onClick={toggle}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted hover:text-text hover:bg-surface-muted transition-colors text-left"
                    >
                        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                        {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                    </button>

                    <div className="border-t border-border mt-1 pt-1">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-surface-muted transition-colors text-left"
                        >
                            <LogOut size={14} />
                            Sign out
                        </button>
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center gap-3 p-2 rounded-md transition-colors border ${isOpen ? 'bg-surface border-border' : 'border-transparent hover:bg-surface-muted'}`}
            >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-contrast font-bold text-xs uppercase">
                    {user.username.substring(0, 2)}
                </div>
                <div className="flex-1 text-left overflow-hidden">
                    <p className="text-sm font-medium text-text truncate">{user.username}</p>
                    <p className="text-xs text-muted truncate">{user.role}</p>
                </div>
                <ChevronUp size={14} className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
        </div>
    );
};

