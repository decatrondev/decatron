import { Bot, Book, Plug, Menu, X, ChevronRight, HelpCircle, Rocket, Grid, MessageSquare } from 'lucide-react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ThemeToggle from '../../components/ThemeToggle';

export default function DocsLayout() {
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [startOpen, setStartOpen] = useState(true);
    const [commandsOpen, setCommandsOpen] = useState(false);
    const [overlaysOpen, setOverlaysOpen] = useState(false);
    const [referenceOpen, setReferenceOpen] = useState(false);
    const isLoggedIn = !!localStorage.getItem('token');

    // Auto-expand sections based on current path
    useEffect(() => {
        if (location.pathname.includes('/docs/commands')) {
            setCommandsOpen(true);
        }
        if (location.pathname.includes('/docs/overlays') || location.pathname.includes('/docs/variables')) {
            setReferenceOpen(true);
        }
    }, [location.pathname]);

    return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D]">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-white dark:bg-[#1B1C1D] border-b border-[#e2e8f0] dark:border-[#374151]">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden p-2 hover:bg-[#f8fafc] dark:hover:bg-[#1B1C1D] rounded-lg transition-colors"
                        >
                            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                        <Link to="/" className="flex items-center gap-2 text-2xl font-black text-[#2563eb]">
                            <Bot className="w-8 h-8" />
                            <span>Decatron</span>
                        </Link>
                        <span className="hidden sm:block px-3 py-1 bg-[#f8fafc] dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] rounded-lg text-sm font-semibold">
                            Documentación
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        {isLoggedIn ? (
                            <Link
                                to="/dashboard"
                                className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                            >
                                Ir al Dashboard
                            </Link>
                        ) : (
                            <Link
                                to="/login"
                                className="px-4 py-2 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg transition-all"
                            >
                                Iniciar Sesión
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <div className="flex">
                {/* Sidebar */}
                <aside className={`fixed lg:sticky top-[4.5rem] left-0 z-30 w-64 h-[calc(100vh-4.5rem)] bg-[#f8fafc] dark:bg-[#1B1C1D] border-r border-[#e2e8f0] dark:border-[#374151] overflow-y-auto transition-transform ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                } lg:translate-x-0`}>
                    <nav className="p-4 space-y-1">
                        {/* Inicio Section */}
                        <div className="mb-4">
                            <button
                                onClick={() => setStartOpen(!startOpen)}
                                className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider"
                            >
                                <span>Inicio</span>
                                <ChevronRight className={`w-3 h-3 transition-transform ${startOpen ? 'rotate-90' : ''}`} />
                            </button>
                            {startOpen && (
                                <div className="mt-1 space-y-1">
                                    <DocNavLink
                                        to="/docs"
                                        icon={<Book className="w-5 h-5" />}
                                        label="Documentacion"
                                        active={location.pathname === '/docs'}
                                    />
                                    <DocNavLink
                                        to="/docs/about"
                                        icon={<HelpCircle className="w-5 h-5" />}
                                        label="Que es Decatron?"
                                        active={location.pathname === '/docs/about'}
                                    />
                                    <DocNavLink
                                        to="/docs/getting-started"
                                        icon={<Rocket className="w-5 h-5" />}
                                        label="Como Empezar"
                                        active={location.pathname === '/docs/getting-started'}
                                    />
                                    <DocNavLink
                                        to="/docs/features"
                                        icon={<Grid className="w-5 h-5" />}
                                        label="Features"
                                        active={location.pathname === '/docs/features'}
                                    />
                                    <DocNavLink
                                        to="/docs/faq"
                                        icon={<MessageSquare className="w-5 h-5" />}
                                        label="FAQ"
                                        active={location.pathname === '/docs/faq'}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Comandos Dropdown */}
                        <div>
                            <button
                                onClick={() => setCommandsOpen(!commandsOpen)}
                                className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider"
                            >
                                <span>Comandos</span>
                                <ChevronRight className={`w-3 h-3 transition-transform ${commandsOpen ? 'rotate-90' : ''}`} />
                            </button>
                            {commandsOpen && (
                                <div className="mt-1 space-y-1">
                                    <SubNavLink to="/docs/commands/default" label="Comandos por Defecto" />
                                    <SubNavLink to="/docs/commands/custom" label="Comandos Personalizados" />
                                    <SubNavLink to="/docs/commands/microcommands" label="Micro Comandos" />
                                    <SubNavLink to="/docs/commands/scripting" label="Scripts" />
                                </div>
                            )}
                        </div>

                        {/* Referencia Dropdown */}
                        <div>
                            <button
                                onClick={() => setReferenceOpen(!referenceOpen)}
                                className="w-full flex items-center justify-between px-4 py-2 text-xs font-bold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wider"
                            >
                                <span>Referencia</span>
                                <ChevronRight className={`w-3 h-3 transition-transform ${referenceOpen ? 'rotate-90' : ''}`} />
                            </button>
                            {referenceOpen && (
                                <div className="mt-1 space-y-1">
                                    <SubNavLink to="/docs/variables" label="Variables" />
                                    <SubNavLink to="/docs/overlays/shoutout" label="Shoutout Overlay" />
                                    <SubNavLink to="/docs/overlays/gacha" label="Gacha Overlay" comingSoon />
                                </div>
                            )}
                        </div>

                        {/* API Reference */}
                        <DocNavLink
                            to="/docs/api"
                            icon={<Plug className="w-5 h-5" />}
                            label="API Reference"
                            active={location.pathname === '/docs/api'}
                        />
                    </nav>
                </aside>

                {/* Mobile Overlay */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-20 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Main Content */}
                <main className="flex-1 w-full min-w-0 px-4 py-8 lg:px-8">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

interface DocNavLinkProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    comingSoon?: boolean;
}

function DocNavLink({ to, icon, label, active, comingSoon }: DocNavLinkProps) {
    if (comingSoon) {
        return (
            <div className="relative">
                <div className="flex items-center gap-3 px-4 py-3 text-[#64748b] dark:text-[#94a3b8] cursor-not-allowed opacity-60 rounded-lg">
                    {icon}
                    <span className="font-medium">{label}</span>
                    <span className="ml-auto px-2 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                        Pronto
                    </span>
                </div>
            </div>
        );
    }

    return (
        <Link
            to={to}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${
                active
                    ? 'bg-[#2563eb] text-white'
                    : 'text-gray-700 dark:text-[#f8fafc] hover:bg-white dark:hover:bg-[#1B1C1D]'
            }`}
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}

// Componente para sub-navegación
interface SubNavLinkProps {
    to: string;
    label: string;
    comingSoon?: boolean;
}

function SubNavLink({ to, label, comingSoon }: SubNavLinkProps) {
    const location = useLocation();
    const active = location.pathname === to;

    if (comingSoon) {
        return (
            <div className="block px-4 py-2 rounded-lg text-sm text-[#64748b] dark:text-[#94a3b8] cursor-not-allowed opacity-60 flex items-center justify-between">
                <span>{label}</span>
                <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                    Pronto
                </span>
            </div>
        );
    }

    return (
        <Link
            to={to}
            className={`block px-4 py-2 rounded-lg text-sm transition-colors ${
                active
                    ? 'bg-[#2563eb] text-white font-medium'
                    : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-white dark:hover:bg-[#1B1C1D] hover:text-[#2563eb]'
            }`}
        >
            {label}
        </Link>
    );
}
