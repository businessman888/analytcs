import { Link, useLocation } from 'react-router-dom';
import { Home, BarChart2, BrainCircuit, User } from 'lucide-react';
import clsx from 'clsx';

export default function Layout({ children }) {
    const location = useLocation();

    const navItems = [
        { icon: Home, label: 'Dashboard', path: '/' },
        { icon: BrainCircuit, label: 'Analysis', path: '/analysis' },
        { icon: BarChart2, label: 'Stats', path: '/stats' },
        { icon: User, label: 'Profile', path: '/profile' },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-nba-dark text-white font-sans selection:bg-nba-red selection:text-white">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-nba-card/80 backdrop-blur-md border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold bg-gradient-to-r from-nba-red to-nba-blue bg-clip-text text-transparent">
                            NBA Precision
                        </span>
                    </div>

                    <nav className="hidden md:flex gap-6">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={clsx(
                                        "flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300",
                                        isActive
                                            ? "bg-white/10 text-nba-blue font-semibold scale-105"
                                            : "text-gray-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    <Icon size={18} />
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </header>

            {/* Mobile Nav */}
            <nav className="md:hidden fixed bottom-0 w-full bg-nba-card border-t border-white/10 z-50 pb-safe">
                <div className="flex justify-around items-center h-16">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    "flex flex-col items-center justify-center w-full h-full transition-colors",
                                    isActive ? "text-nba-blue" : "text-gray-500 hover:text-gray-300"
                                )}
                            >
                                <Icon size={20} />
                                <span className="text-[10px] mt-1">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
                {children}
            </main>
        </div>
    );
}
