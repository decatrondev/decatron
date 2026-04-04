import { Bot, Home, Zap, Target, Settings, LogOut, Menu, Clock, Book, Shield, Cpu, BarChart3, MessageSquare, User } from 'lucide-react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ThemeToggle from './ThemeToggle';
import ChannelSwitcher from './ChannelSwitcher';
import { usePermissions } from '../hooks/usePermissions';
import { useTokenMonitor } from '../hooks/useTokenMonitor';
import { notifyTokenRemoved } from '../utils/tokenEvents';

function parseJwtClaims(token: string | null): Record<string, string> {
    if (!token) return {};
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(base64));
    } catch { return {}; }
}

export default function Layout() {
    const { t, ready } = useTranslation(['layout', 'common']);
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isSystemOwner, setIsSystemOwner] = useState(false);
    const { hasMinimumLevel, loading } = usePermissions();

    // Parse JWT to get auth provider info — re-parse on route changes (token may have changed)
    const jwtClaims = useMemo(() => parseJwtClaims(localStorage.getItem('token')), [location.pathname]);
    const authProvider = jwtClaims.AuthProvider || 'twitch';
    const isDiscordOnly = authProvider === 'discord';
    const hasTwitchAccess = authProvider === 'twitch' || authProvider === 'both';
    const profileImage = jwtClaims.ProfileImage || '';
    const displayName = jwtClaims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || jwtClaims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || 'User';


    // Verificar si el usuario es owner del sistema (para Admin de Decatron IA)
    useEffect(() => {
        const checkOwner = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const response = await fetch('/api/admin/decatron-ai/check-owner', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setIsSystemOwner(data.isOwner === true);
                }
            } catch {
                // Silenciar error, no es crítico
            }
        };

        checkOwner();
    }, []);

    // Monitorear el token y mostrar advertencia si está por expirar
    const tokenStatus = useTokenMonitor({
        checkInterval: 30000, // Verificar cada 30 segundos
        warningThreshold: 300 // Advertir 5 minutos antes
    });

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

    // Si está cargando permisos o i18n no está listo, mostrar un placeholder
    if (loading || !ready) {
        return (
            <div className="flex h-screen bg-white dark:bg-[#1B1C1D] items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2563eb] mx-auto"></div>
                    <p className="mt-4 text-[#64748b] dark:text-[#94a3b8]">{ready ? t('layout:loadingPermissions') : 'Cargando...'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-white dark:bg-[#1B1C1D] overflow-hidden">
            {/* Sidebar */}
            <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-[#f8fafc] dark:bg-[#1B1C1D] border-r border-[#e2e8f0] dark:border-[#374151] transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform flex flex-col`}>
                <div className="p-6 border-b border-[#e2e8f0] dark:border-[#374151] flex-shrink-0">
                    <Link to="/dashboard" className="flex items-center gap-2 text-2xl font-black text-[#2563eb]">
                        <Bot className="w-8 h-8" />
                        <span>Decatron</span>
                    </Link>
                </div>

                <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
                    {/* User Card */}
                    <Link to="/me" className="flex items-center gap-3 p-3 mb-2 rounded-xl bg-white dark:bg-[#374151]/30 border border-[#e2e8f0] dark:border-[#374151] hover:border-[#2563eb] dark:hover:border-[#2563eb] transition-colors">
                        <div className="w-10 h-10 rounded-full bg-[#374151] flex items-center justify-center text-sm font-bold text-white overflow-hidden flex-shrink-0">
                            {profileImage ? (
                                <img src={profileImage} alt="" className="w-full h-full object-cover" />
                            ) : (
                                displayName[0]?.toUpperCase() || '?'
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{displayName}</p>
                            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                                {isDiscordOnly ? 'Discord' : hasTwitchAccess && authProvider === 'both' ? 'Twitch + Discord' : 'Twitch'}
                            </p>
                        </div>
                    </Link>

                    {/* Mi Perfil — Single button, hub page */}
                    <NavLink to="/me" icon={<User />} label="Mi Perfil" active={location.pathname.startsWith('/me')} />

                    {/* Dashboard & Settings */}
                    <hr className="my-2 border-[#e2e8f0] dark:border-[#374151]" />
                    <NavLink to="/dashboard" icon={<Home />} label={t('layout:navigation.dashboard')} active={location.pathname === '/dashboard'} />
                    <NavLink to="/settings" icon={<Settings />} label={t('layout:navigation.settings')} active={location.pathname === '/settings'} />

                    {/* ========== PANEL STREAMER — Solo Twitch/Both ========== */}
                    {hasTwitchAccess && (
                        <>
                            <hr className="my-2 border-[#e2e8f0] dark:border-[#374151]" />
                            <p className="px-4 text-xs font-bold text-[#94a3b8] dark:text-[#64748b] uppercase tracking-wider">Panel Streamer</p>

                            <NavLink to="/commands" icon={<Zap />} label={t('layout:navigation.commands.title')} active={location.pathname.startsWith('/commands')} />
                            <NavLink to="/overlays" icon={<Target />} label={t('layout:navigation.overlays.title')} active={location.pathname.startsWith('/overlays')} />
                            <NavLink to="/features" icon={<Target />} label={t('layout:navigation.features.title')} active={location.pathname === '/features'} />
                            <NavLink to="/moderation" icon={<Shield />} label={t('layout:navigation.moderation.title')} active={location.pathname.startsWith('/moderation')} />
                            <NavLink to="/discord" icon={<MessageSquare />} label="Discord" active={location.pathname.startsWith('/discord')} />
                            <NavLink to="/analytics" icon={<BarChart3 />} label={t('layout:navigation.analytics', 'Analytics')} active={location.pathname === '/analytics'} />

                            {isSystemOwner && (
                                <NavLink to="/admin" icon={<Cpu />} label={t('layout:navigation.admin.title')} active={location.pathname.startsWith('/admin')} />
                            )}
                        </>
                    )}

                    <hr className="my-4 border-[#e2e8f0] dark:border-[#374151]" />

                    {/* Docs */}
                    <NavLink to="/dashboard/docs" icon={<Book />} label={t('layout:navigation.documentation.title')} active={location.pathname.startsWith('/dashboard/docs')} />

                    <button
                        onClick={() => {
                            localStorage.removeItem('token');
                            notifyTokenRemoved();
                            window.location.href = '/';
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-semibold">{t('layout:navigation.logout')}</span>
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Navbar */}
                <nav className="bg-white dark:bg-[#1B1C1D] border-b border-[#e2e8f0] dark:border-[#374151] px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={toggleSidebar} className="md:hidden p-2 hover:bg-[#f8fafc] dark:hover:bg-[#1B1C1D] rounded-lg">
                            <Menu className="w-6 h-6" />
                        </button>
                        <ThemeToggle />
                    </div>
                    {hasTwitchAccess && <ChannelSwitcher />}
                </nav>

                {/* Token Expiration Warning Banner */}
                {tokenStatus.isExpiringSoon && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-6 py-3">
                        <div className="flex items-center gap-3 text-yellow-800 dark:text-yellow-400">
                            <Clock className="w-5 h-5 animate-pulse" />
                            <div className="flex-1">
                                <p className="font-semibold">{t('layout:tokenExpiration.title')}</p>
                                <p className="text-sm">
                                    {t('layout:tokenExpiration.message', { minutes: Math.floor(tokenStatus.secondsRemaining / 60) })}
                                </p>
                            </div>
                            <button
                                onClick={() => window.location.href = '/api/auth/login'}
                                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm font-semibold"
                            >
                                {t('layout:tokenExpiration.renewButton')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

interface NavLinkProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    active: boolean;
    id?: string;
}

function NavLink({ to, icon, label, active, id }: NavLinkProps) {
    return (
        <Link to={to} id={id} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-[#2563eb] text-white' : 'text-gray-700 dark:text-[#f8fafc] hover:bg-white dark:hover:bg-[#1B1C1D]'}`}>
            {icon}
            <span className="font-semibold">{label}</span>
        </Link>
    );
}

interface SubNavLinkProps {
    to: string;
    label: string;
    comingSoon?: boolean;
}

function SubNavLink({ to, label, comingSoon }: SubNavLinkProps) {
    const { t } = useTranslation(['layout']);

    if (comingSoon) {
        return (
            <div className="flex items-center justify-between px-4 py-2 rounded-lg text-sm text-[#64748b] dark:text-[#94a3b8] cursor-not-allowed opacity-60">
                <span>{label}</span>
                <span className="px-2 py-0.5 text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                    {t('layout:comingSoon')}
                </span>
            </div>
        );
    }

    return (
        <Link to={to} className="block px-4 py-2 rounded-lg text-sm text-[#64748b] dark:text-[#94a3b8] hover:bg-white dark:hover:bg-[#1B1C1D] hover:text-[#2563eb] transition-colors">
            {label}
        </Link>
    );
}