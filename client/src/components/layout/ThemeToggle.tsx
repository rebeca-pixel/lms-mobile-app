import React from 'react';
import { useTheme } from '@/context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="relative flex items-center w-14 h-7 bg-slate-200 dark:bg-slate-800 rounded-full p-1 transition-colors duration-300 focus:outline-none"
            aria-label="Toggle Theme"
        >
            <div
                className={`absolute w-5 h-5 bg-white dark:bg-blue-500 rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${theme === 'dark' ? 'translate-x-[26px]' : 'translate-x-0'
                    }`}
            >
                {theme === 'dark' ? (
                    <Moon className="w-3 h-3 text-white" />
                ) : (
                    <Sun className="w-3 h-3 text-yellow-500" />
                )}
            </div>
            <div className="flex justify-between w-full px-1 text-[10px]">
                <Sun className={`w-3 h-3 ${theme === 'light' ? 'opacity-0' : 'text-slate-500 opacity-50'}`} />
                <Moon className={`w-3 h-3 ${theme === 'dark' ? 'opacity-0' : 'text-slate-400 opacity-50'}`} />
            </div>
        </button>
    );
};
