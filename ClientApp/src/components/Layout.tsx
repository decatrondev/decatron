import { Bot, Home, Zap, Target, Settings, LogOut, Menu, ChevronRight, Clock, Book, Shield, Cpu, Users, Gift, DollarSign, BarChart3 } from 'lucide-react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ThemeToggle from './ThemeToggle';
import ChannelSwitcher from './ChannelSwitcher';
import { usePermissions } from '../hooks/usePermissions';
import { useTokenMonitor } from '../hooks/useTokenMonitor';
import { notifyTokenRemoved } from '../utils/tokenEvents';

export default function Layout() {
    const { t, ready } = useTranslation(['layout', 'common']);
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [commandsOpen, setCommandsOpen] = useState(false);
    const [overlaysOpen, setOverlaysOpen] = useState(false);
    const [featuresOpen, setFeaturesOpen] = useState(false);
    const [moderationOpen, setModerationOpen] = useState(false);
    const [docsOpen, setDocsOpen] = useState(false);
    const [docsCommandsOpen, setDocsCommandsOpen] = useState(false);
    const [docsOverlaysOpen, setDocsOverlaysOpen] = useState(false);
    const [docsFeaturesOpen, setDocsFeaturesOpen] = useState(false);
    const [docsSettingsOpen, setDocsSettingsOpen] = useState(false);
    const [adminOpen, setAdminOpen] = useState(false);
    const [isSystemOwner, setIsSystemOwner] = useState(false);
    const { hasMinimumLevel, loading } = usePermissions();

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
                    <NavLink to="/dashboard" icon={<Home />} label={t('layout:navigation.dashboard')} active={location.pathname === '/dashboard'} />

                    {/* Gestión de Seguidores - Visible solo con nivel 'commands' o superior */}
                    {hasMinimumLevel('commands') && (
                        <NavLink to="/followers" icon={<Users />} label={t('layout:navigation.followers')} active={location.pathname === '/followers'} />
                    )}

                    {/* Comandos Group - Visible solo con nivel 'commands' o superior */}
                    {hasMinimumLevel('commands') && (
                        <div>
                            <button onClick={() => setCommandsOpen(!commandsOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white dark:hover:bg-[#1B1C1D] transition-colors text-gray-700 dark:text-[#f8fafc]">
                                <div className="flex items-center gap-3">
                                    <Zap className="w-5 h-5" />
                                    <span className="font-semibold">{t('layout:navigation.commands.title')}</span>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-transform ${commandsOpen ? 'rotate-90' : ''}`} />
                            </button>
                            {commandsOpen && (
                                <div className="ml-8 mt-1 space-y-1">
                                    <SubNavLink to="/commands/default" label={t('layout:navigation.commands.default')} />
                                    <SubNavLink to="/commands/microcommands" label={t('layout:navigation.commands.microcommands')} />
                                    <SubNavLink to="/commands/custom" label={t('layout:navigation.commands.custom')} />
                                    <SubNavLink to="/commands/scripting" label={t('layout:navigation.commands.scripting')} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Overlays Group - Visible solo con nivel 'moderation' o superior */}
                    {hasMinimumLevel('moderation') && (
                        <div>
                            <button onClick={() => setOverlaysOpen(!overlaysOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white dark:hover:bg-[#1B1C1D] transition-colors text-gray-700 dark:text-[#f8fafc]">
                                <div className="flex items-center gap-3">
                                    <Target className="w-5 h-5" />
                                    <span className="font-semibold">{t('layout:navigation.overlays.title')}</span>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-transform ${overlaysOpen ? 'rotate-90' : ''}`} />
                            </button>
                            {overlaysOpen && (
                                <div className="ml-8 mt-1 space-y-1">
                                    <SubNavLink to="/overlays" label={t('layout:navigation.overlays.viewAll')} />
                                    <SubNavLink to="/overlays/shoutout" label={t('layout:navigation.overlays.shoutout')} />
                                    <SubNavLink to="/overlays/timer" label={t('layout:navigation.overlays.timer')} />
                                    <SubNavLink to="/overlays/goals" label="Metas" />
                                    <SubNavLink to="/overlays/event-alerts" label="Event Alerts" />
                                    <SubNavLink to="/features/giveaways" label={t('layout:navigation.overlays.giveaway')} />
                                    <SubNavLink to="/overlays/gacha" label={t('layout:navigation.overlays.gacha')} comingSoon />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Funciones Group - Visible solo con nivel 'moderation' o superior */}
                    {hasMinimumLevel('moderation') && (
                        <div id="features-menu-group">
                            <button onClick={() => setFeaturesOpen(!featuresOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white dark:hover:bg-[#1B1C1D] transition-colors text-gray-700 dark:text-[#f8fafc]">
                                <div className="flex items-center gap-3">
                                    <Target className="w-5 h-5" />
                                    <span className="font-semibold">{t('layout:navigation.features.title')}</span>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-transform ${featuresOpen ? 'rotate-90' : ''}`} />
                            </button>
                            {featuresOpen && (
                                <div className="ml-8 mt-1 space-y-1">
                                    <SubNavLink to="/features/timers" label={t('layout:navigation.features.timers')} />
                                    <SubNavLink to="/features/giveaways" label={t('layout:navigation.features.giveaways')} />
                                    <SubNavLink to="/features/sound-alerts" label={t('layout:navigation.features.soundAlerts')} />
                                    <SubNavLink to="/features/follow-alerts" label={t('layout:navigation.features.followAlerts')} />
                                    <SubNavLink to="/features/decatron-chat" label={t('layout:navigation.features.decatronChat')} />
                                    <SubNavLink to="/features/tips" label="💰 Tips (PayPal)" />
                                    {hasMinimumLevel('control_total') && (
                                        <SubNavLink to="/features/decatron-ai" label={t('layout:navigation.features.decatronAI')} />
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Chat Moderation - Visible solo con nivel 'moderation' o superior */}
                    {hasMinimumLevel('moderation') && (
                        <div>
                            <button onClick={() => setModerationOpen(!moderationOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white dark:hover:bg-[#1B1C1D] transition-colors text-gray-700 dark:text-[#f8fafc]">
                                <div className="flex items-center gap-3">
                                    <Shield className="w-5 h-5" />
                                    <span className="font-semibold">{t('layout:navigation.moderation.title')}</span>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-transform ${moderationOpen ? 'rotate-90' : ''}`} />
                            </button>
                            {moderationOpen && (
                                <div className="ml-8 mt-1 space-y-1">
                                    <SubNavLink to="/features/moderation/banned-words" label={t('layout:navigation.moderation.bannedWords')} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Admin - Solo visible para owner del sistema (tabla system_admins) */}
                    {isSystemOwner && (
                        <div>
                            <button onClick={() => setAdminOpen(!adminOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white dark:hover:bg-[#1B1C1D] transition-colors text-gray-700 dark:text-[#f8fafc]">
                                <div className="flex items-center gap-3">
                                    <Cpu className="w-5 h-5" />
                                    <span className="font-semibold">{t('layout:navigation.admin.title')}</span>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-transform ${adminOpen ? 'rotate-90' : ''}`} />
                            </button>
                            {adminOpen && (
                                <div className="ml-8 mt-1 space-y-1">
                                    <SubNavLink to="/admin/decatron-ai" label={t('layout:navigation.admin.decatronAI')} />
                                    <SubNavLink to="/admin/decatron-chat" label={t('layout:navigation.admin.decatronChat')} />
                                    <SubNavLink to="/admin/donations" label="❤️ Mis Donaciones" />
                                    <SubNavLink to="/admin/supporters" label="🌟 Supporters" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Configuración - Visible solo con nivel 'control_total' (owner o permisos totales) */}
                    {hasMinimumLevel('control_total') && (
                        <NavLink to="/settings" icon={<Settings />} label={t('layout:navigation.settings')} active={location.pathname === '/settings'} id="settings-link" />
                    )}

                    {/* Analytics - Visible para nivel 'moderation' o superior */}
                    {hasMinimumLevel('moderation') && (
                        <NavLink to="/analytics" icon={<BarChart3 />} label={t('layout:navigation.analytics', 'Analytics')} active={location.pathname === '/analytics'} />
                    )}

                    <hr className="my-4 border-[#e2e8f0] dark:border-[#374151]" />

                    {/* Documentacion - Visible para todos */}
                    <div>
                        <button onClick={() => setDocsOpen(!docsOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-white dark:hover:bg-[#1B1C1D] transition-colors text-gray-700 dark:text-[#f8fafc]">
                            <div className="flex items-center gap-3">
                                <Book className="w-5 h-5" />
                                <span className="font-semibold">{t('layout:navigation.documentation.title')}</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 transition-transform ${docsOpen ? 'rotate-90' : ''}`} />
                        </button>
                        {docsOpen && (
                            <div className="ml-8 mt-1 space-y-1">
                                <SubNavLink to="/dashboard/docs" label="Centro de Ayuda" />
                                <SubNavLink to="/dashboard/docs/overlays" label="Configurar Overlays (OBS)" />

                                {/* Comandos Dropdown */}
                                <div>
                                    <button
                                        onClick={() => setDocsCommandsOpen(!docsCommandsOpen)}
                                        className="w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm text-[#64748b] dark:text-[#94a3b8] hover:bg-white dark:hover:bg-[#1B1C1D] hover:text-[#2563eb] transition-colors"
                                    >
                                        <span>Comandos</span>
                                        <ChevronRight className={`w-3 h-3 transition-transform ${docsCommandsOpen ? 'rotate-90' : ''}`} />
                                    </button>
                                    {docsCommandsOpen && (
                                        <div className="ml-4 mt-1 space-y-1">
                                            <SubNavLink to="/dashboard/docs/commands/default" label="Por Defecto" />
                                            <SubNavLink to="/dashboard/docs/commands/custom" label="Personalizados" />
                                            <SubNavLink to="/dashboard/docs/commands/microcommands" label="Micro Comandos" />
                                            <SubNavLink to="/dashboard/docs/commands/scripting" label="Scripts" />
                                        </div>
                                    )}
                                </div>

                                {/* Features Dropdown */}
                                <div>
                                    <button
                                        onClick={() => setDocsFeaturesOpen(!docsFeaturesOpen)}
                                        className="w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm text-[#64748b] dark:text-[#94a3b8] hover:bg-white dark:hover:bg-[#1B1C1D] hover:text-[#2563eb] transition-colors"
                                    >
                                        <span>Features</span>
                                        <ChevronRight className={`w-3 h-3 transition-transform ${docsFeaturesOpen ? 'rotate-90' : ''}`} />
                                    </button>
                                    {docsFeaturesOpen && (
                                        <div className="ml-4 mt-1 space-y-1">
                                            <SubNavLink to="/dashboard/docs/features/timer" label="Timer" />
                                            <SubNavLink to="/dashboard/docs/features/event-alerts" label="Alertas de Eventos" />
                                            <SubNavLink to="/dashboard/docs/features/giveaway" label="Sorteos" />
                                            <SubNavLink to="/dashboard/docs/features/goals" label="Metas" />
                                            <SubNavLink to="/dashboard/docs/features/sound-alerts" label="Sound Alerts" />
                                            <SubNavLink to="/dashboard/docs/features/tips" label="Donaciones" />
                                            <SubNavLink to="/dashboard/docs/features/shoutout" label="Shoutouts" />
                                            <SubNavLink to="/dashboard/docs/features/moderation" label="Moderacion" />
                                            <SubNavLink to="/dashboard/docs/features/ai" label="Decatron AI" />
                                        </div>
                                    )}
                                </div>

                                {/* Configuracion Dropdown */}
                                <div>
                                    <button
                                        onClick={() => setDocsSettingsOpen(!docsSettingsOpen)}
                                        className="w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm text-[#64748b] dark:text-[#94a3b8] hover:bg-white dark:hover:bg-[#1B1C1D] hover:text-[#2563eb] transition-colors"
                                    >
                                        <span>Configuracion</span>
                                        <ChevronRight className={`w-3 h-3 transition-transform ${docsSettingsOpen ? 'rotate-90' : ''}`} />
                                    </button>
                                    {docsSettingsOpen && (
                                        <div className="ml-4 mt-1 space-y-1">
                                            <SubNavLink to="/dashboard/docs/settings" label="Ajustes del Bot" />
                                            <SubNavLink to="/dashboard/docs/permissions" label="Permisos" />
                                            <SubNavLink to="/dashboard/docs/variables" label="Variables" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

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
                    <ChannelSwitcher />
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