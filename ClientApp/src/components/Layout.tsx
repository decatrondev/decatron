import { Home, Zap, Target, Settings, LogOut, Menu, Clock, Book, Shield, Cpu, BarChart3, MessageSquare, User, Coins } from 'lucide-react';
import decatronLockup from '../assets/decatron-lockup.png';
import { BrandMark } from '../brand/BrandMark';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
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
    const { t } = useTranslation(['layout', 'common']);
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isSystemOwner, setIsSystemOwner] = useState(false);
    const { hasMinimumLevel, loading: permissionsLoading } = usePermissions();

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

    return (
        <div className="flex h-screen bg-ds-bg overflow-hidden">
            {/* Sidebar */}
            <aside className={`panel-scale fixed md:static inset-y-0 left-0 z-50 w-64 bg-ds-surface border-r border-ds-border transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform flex flex-col`}>
                <div className="p-6 border-b border-ds-border flex-shrink-0">
                    <Link to="/dashboard" className="flex items-center">
                        <BrandMark slot="panel-sidebar" fallback={<><img src={decatronLockup} alt="Decatron" className="h-10 object-contain dark:hidden" /><img src="/brand/decatron-lockup-light.png" alt="Decatron" className="h-10 object-contain hidden dark:block" /></>} />
                    </Link>
                </div>

                <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
                    {/* User Card */}
                    <Link to="/me" className="flex items-center gap-3 p-3 mb-2 rounded-lg bg-ds-bg border border-ds-border hover:border-ds-accent transition-colors">
                        <div className="w-10 h-10 rounded-full bg-ds-raised border border-ds-border flex items-center justify-center text-sm font-bold text-ds-text overflow-hidden flex-shrink-0">
                            {profileImage ? (
                                <img src={profileImage} alt="" className="w-full h-full object-cover" />
                            ) : (
                                displayName[0]?.toUpperCase() || '?'
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold text-sm text-ds-text truncate">{displayName}</p>
                            <p className="text-xs text-ds-soft">
                                {isDiscordOnly ? 'Discord' : hasTwitchAccess && authProvider === 'both' ? 'Twitch + Discord' : 'Twitch'}
                            </p>
                        </div>
                    </Link>

                    {/* Mi Perfil — Single button, hub page */}
                    <NavLink to="/me" icon={<User />} label="Mi Perfil" active={location.pathname === '/me' || location.pathname.startsWith('/me/') && !location.pathname.startsWith('/me/spirits')} />
                    <NavLink to="/me/spirits" icon={<Zap className="text-ds-accent-text" />} label="Fortnite Spirits" active={location.pathname === '/me/spirits'} />

                    {/* Dashboard & Settings */}
                    <hr className="my-2 border-ds-border" />
                    <NavLink to="/dashboard" icon={<Home />} label={t('layout:navigation.dashboard')} active={location.pathname === '/dashboard'} />
                    <NavLink to="/settings" icon={<Settings />} label={t('layout:navigation.settings')} active={location.pathname === '/settings'} />

                    {/* ========== PANEL STREAMER ========== */}
                    {(hasTwitchAccess || !isDiscordOnly) && (
                        <>
                            <hr className="my-2 border-ds-border" />
                            <p className="px-4 text-xs font-bold text-ds-soft uppercase tracking-wider">Panel Streamer</p>

                            {/* Comandos: ya verificado que resuelve el canal de forma
                                generica (sesion/claim/JWT), sirve para Kick tal cual.
                                Ver .dev/plans/UNIFICACION_MULTIPLATAFORMA_PLAN.md
                                seccion 8.16. El resto (overlays, moderacion, discord,
                                analytics) se habilita para Kick de a uno, verificando
                                cada uno primero — no se asume que tambien sirven. */}
                            <NavLink to="/commands" icon={<Zap />} label={t('layout:navigation.commands.title')} active={location.pathname.startsWith('/commands')} />

                            {/* Overlays: visible para Kick, pero todavia sin ningun
                                overlay verificado de ese lado — Overlays.tsx marca
                                cada card como "Proximamente en Kick" hasta que se
                                confirme card por card, mismo criterio que Default
                                Commands (plan seccion 8.17). */}
                            <NavLink to="/overlays" icon={<Target />} label={t('layout:navigation.overlays.title')} active={location.pathname.startsWith('/overlays')} />

                            {/* Funciones: visible para Kick. Sound Alerts (el primero
                                verificado en Kick, plan seccion 8, item 3) ahora vive
                                en Overlays; el resto de FeaturesHub se marca
                                "Proximamente en Kick" hasta verificarse. */}
                            <NavLink to="/features" icon={<Target />} label={t('layout:navigation.features.title')} active={location.pathname === '/features'} />
                            <NavLink to="/credits" icon={<Coins />} label={t('layout:navigation.credits')} active={location.pathname.startsWith('/credits')} />

                            {hasTwitchAccess && (
                                <>
                                    <NavLink to="/moderation" icon={<Shield />} label={t('layout:navigation.moderation.title')} active={location.pathname.startsWith('/moderation')} />
                                    <NavLink to="/discord" icon={<MessageSquare />} label="Discord" active={location.pathname.startsWith('/discord')} />
                                    <NavLink to="/analytics" icon={<BarChart3 />} label={t('layout:navigation.analytics', 'Analytics')} active={location.pathname === '/analytics'} />
                                </>
                            )}

                            {isSystemOwner && (
                                <NavLink to="/admin" icon={<Cpu />} label={t('layout:navigation.admin.title')} active={location.pathname.startsWith('/admin')} />
                            )}
                        </>
                    )}

                    <hr className="my-4 border-ds-border" />

                    {/* Docs */}
                    <NavLink to="/dashboard/docs" icon={<Book />} label={t('layout:navigation.documentation.title')} active={location.pathname.startsWith('/dashboard/docs')} />

                    <button
                        onClick={() => {
                            localStorage.removeItem('token');
                            notifyTokenRemoved();
                            navigate('/login');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-ds-danger/10 transition-colors text-ds-danger"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-semibold">{t('layout:navigation.logout')}</span>
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                {/* Navbar */}
                <nav className="panel-scale bg-ds-surface border-b border-ds-border px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={toggleSidebar} className="md:hidden p-2 hover:bg-ds-bg rounded-lg">
                            <Menu className="w-6 h-6" />
                        </button>
                        <ThemeToggle />
                    </div>
                    {/* Antes gateado por hasTwitchAccess (con que plataforma entraste vos),
                        no por si tenes algo que gestionar. Un canal de Kick al que otro
                        streamer le dio acceso de moderador no tiene por que ver Twitch para
                        que esto le sirva — mismo criterio que ya usa "Gestion de Accesos"
                        en Settings (!isDiscordOnly). Ver plan de unificacion, seccion 8.12. */}
                    {!isDiscordOnly && <ChannelSwitcher />}
                </nav>

                {/* Token Expiration Warning Banner */}
                {tokenStatus.isExpiringSoon && (
                    <div className="bg-ds-warn/10 border-b border-ds-warn/30 px-6 py-3">
                        <div className="flex items-center gap-3 text-ds-warn">
                            <Clock className="w-5 h-5 animate-pulse" />
                            <div className="flex-1">
                                <p className="font-semibold">{t('layout:tokenExpiration.title')}</p>
                                <p className="text-sm">
                                    {t('layout:tokenExpiration.message', { minutes: Math.floor(tokenStatus.secondsRemaining / 60) })}
                                </p>
                            </div>
                            <button
                                onClick={() => window.location.href = '/api/auth/login'}
                                className="px-4 py-2 bg-ds-accent hover:bg-ds-accent-hover text-white rounded-lg transition-colors text-sm font-semibold"
                            >
                                {t('layout:tokenExpiration.renewButton')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Page Content */}
                {/* `min-w-0` es lo que impide el scroll horizontal en TODO el panel: sin
                    el, un hijo ancho estira este flex en vez de encogerse, y como el div
                    raiz es `overflow-hidden` lo que sobra no genera barra — se pierde de
                    vista sin avisar. El padding baja en pantallas chicas: 64px de aire a
                    los lados en un portatil son 64px que no tiene la tabla. */}
                <main className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6 xl:p-8">
                    {permissionsLoading ? (
                        <div className="flex items-center justify-center h-32">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ds-accent"></div>
                        </div>
                    ) : (
                        <Outlet />
                    )}
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
        <Link to={to} id={id} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-ds-accent text-white' : 'text-ds-text hover:bg-ds-bg'}`}>
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
            <div className="flex items-center justify-between px-4 py-2 rounded-lg text-sm text-ds-soft cursor-not-allowed opacity-60">
                <span>{label}</span>
                <span className="px-2 py-0.5 text-xs font-bold bg-ds-raised border border-ds-border text-ds-soft rounded-full">
                    {t('layout:comingSoon')}
                </span>
            </div>
        );
    }

    return (
        <Link to={to} className="block px-4 py-2 rounded-lg text-sm text-ds-soft hover:bg-ds-bg hover:text-ds-accent-text transition-colors">
            {label}
        </Link>
    );
}