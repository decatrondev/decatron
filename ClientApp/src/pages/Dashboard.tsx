import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { notifyTokenChanged } from '../utils/tokenEvents';
import {
    Radio,
    Settings,
    Zap,
    MessageSquare,
    TrendingUp,
    ExternalLink,
    Bot,
    Activity,
    Server,
    Trophy,
    Coins,
    ShoppingBag,
    Palette,
    Link2
} from 'lucide-react';
import api from '../services/api';

function parseJwt(token: string | null): Record<string, string> {
    if (!token) return {};
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(window.atob(base64));
    } catch { return {}; }
}

export default function Dashboard() {
    const { t } = useTranslation(['dashboard', 'common']);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [botStatus, setBotStatus] = useState<any>(null);

    const jwtClaims = useMemo(() => parseJwt(localStorage.getItem('token')), []);
    const authProvider = jwtClaims.AuthProvider || 'twitch';
    const isDiscordOnly = authProvider === 'discord';
    const isKickOnly = authProvider === 'kick';
    const displayName = jwtClaims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'] || jwtClaims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || 'User';

    useEffect(() => {
        // Token exchange is handled in main.tsx before React mounts
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            localStorage.removeItem('isAuthenticating');
            setIsLoading(false);
        } else {
            // No token — redirect to login
            window.location.href = '/login';
        }
    }, []);

    useEffect(() => {
        // isDiscordOnly no tiene bot de Twitch conectado; isKickOnly tampoco tiene
        // bot de Kick conectado todavia (ver plan de unificacion, seccion 8.5) —
        // en ninguno de los dos casos existe un estado de bot real que pedir.
        if (!isLoading && !isDiscordOnly && !isKickOnly) {
            loadBotStatus();
        }
    }, [isLoading, isDiscordOnly, isKickOnly]);

    const loadBotStatus = async () => {
        try {
            const response = await api.get('/settings/bot/status');
            if (response.data.success) {
                setBotStatus(response.data);
            }
        } catch (error) {
            console.error('Error loading bot status:', error);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-ds-surface">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ds-accent mx-auto mb-4"></div>
                    <p className="text-ds-soft">{t('dashboard:loading')}</p>
                </div>
            </div>
        );
    }

    // Discord-only dashboard
    if (isDiscordOnly) {
        return (
            <div className="panel-scale">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-4xl font-black text-ds-text mb-2">
                            Bienvenido, {displayName}
                        </h1>
                        <p className="text-ds-soft">
                            Tu panel de Decatron
                        </p>
                    </div>

                    {/* CTA Vincular Twitch */}
                    <div className="mb-6 bg-ds-surface border border-ds-border rounded-lg p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-ds-bg border border-ds-border rounded-lg flex-shrink-0">
                                <Link2 className="w-6 h-6 text-[#9146ff]" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-black text-ds-text mb-1">Vincula tu cuenta de Twitch</h3>
                                <p className="text-sm text-ds-soft">Desbloquea el bot, comandos, overlays y todas las funciones de streamer</p>
                            </div>
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await api.post('/auth/link-twitch-start');
                                        if (res.data.url) window.location.href = res.data.url;
                                    } catch { /* error */ }
                                }}
                                className="ds-btn ds-btn--primary ds-btn--lg flex-shrink-0"
                            >
                                Vincular Twitch
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Mi Perfil */}
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                            <h3 className="text-xl font-black text-ds-text mb-4 flex items-center gap-2">
                                <Trophy className="w-6 h-6 text-ds-accent-text" />
                                Mi Perfil
                            </h3>
                            <div className="space-y-3">
                                <button onClick={() => navigate('/me')} className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left">
                                    <p className="font-bold text-ds-text text-sm">Overview</p>
                                    <p className="text-xs text-ds-soft mt-1">Tu nivel, stats y rank card</p>
                                </button>
                                <button onClick={() => navigate('/me/account')} className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left">
                                    <p className="font-bold text-ds-text text-sm">Mi Cuenta</p>
                                    <p className="text-xs text-ds-soft mt-1">Vincular cuentas y preferencias</p>
                                </button>
                            </div>
                        </div>

                        {/* Servidores */}
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                            <h3 className="text-xl font-black text-ds-text mb-4 flex items-center gap-2">
                                <Server className="w-6 h-6 text-ds-accent-text" />
                                Mis Servidores
                            </h3>
                            <p className="text-sm text-ds-soft py-8 text-center">Proximamente</p>
                        </div>

                        {/* DecaCoins */}
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                            <h3 className="text-xl font-black text-ds-text mb-4 flex items-center gap-2">
                                <Coins className="w-6 h-6 text-ds-accent-text" />
                                DecaCoins
                            </h3>
                            <p className="text-sm text-ds-soft py-8 text-center">Proximamente</p>
                        </div>

                        {/* Marketplace */}
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                            <h3 className="text-xl font-black text-ds-text mb-4 flex items-center gap-2">
                                <Palette className="w-6 h-6 text-ds-accent-text" />
                                Marketplace
                            </h3>
                            <p className="text-sm text-ds-soft py-8 text-center">Proximamente</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Kick-only dashboard — el login funciona (ver plan de unificacion, seccion
    // 8.5), pero el motor de comandos todavia no sabe hablarle a un canal de
    // Kick. Mensaje honesto en vez de un dashboard de Twitch roto a medias.
    if (isKickOnly) {
        return (
            <div className="panel-scale">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-4xl font-black text-ds-text mb-2">
                            Bienvenido, {displayName}
                        </h1>
                        <p className="text-ds-soft">
                            Tu panel de Decatron
                        </p>
                    </div>

                    <div className="mb-6 bg-ds-surface border border-ds-border rounded-lg p-6">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-ds-bg border border-ds-border rounded-lg flex-shrink-0">
                                <Bot className="w-6 h-6 text-[#53fc18]" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-black text-ds-text mb-1">Tu cuenta de Kick ya está lista</h3>
                                <p className="text-sm text-ds-soft">El bot para Kick todavía está en desarrollo — comandos, moderación y overlays llegan pronto a este panel.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                            <h3 className="text-xl font-black text-ds-text mb-4 flex items-center gap-2">
                                <Trophy className="w-6 h-6 text-ds-accent-text" />
                                Mi Perfil
                            </h3>
                            <div className="space-y-3">
                                <button onClick={() => navigate('/me')} className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left">
                                    <p className="font-bold text-ds-text text-sm">Overview</p>
                                    <p className="text-xs text-ds-soft mt-1">Tu nivel, stats y rank card</p>
                                </button>
                                <button onClick={() => navigate('/me/account')} className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left">
                                    <p className="font-bold text-ds-text text-sm">Mi Cuenta</p>
                                    <p className="text-xs text-ds-soft mt-1">Preferencias de tu cuenta</p>
                                </button>
                            </div>
                        </div>

                        <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                            <h3 className="text-xl font-black text-ds-text mb-4 flex items-center gap-2">
                                <Coins className="w-6 h-6 text-ds-accent-text" />
                                DecaCoins
                            </h3>
                            <p className="text-sm text-ds-soft py-8 text-center">Próximamente</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="panel-scale">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-black text-ds-text mb-2">
                        {t('dashboard:header.title')}
                    </h1>
                    <p className="text-ds-soft">
                        {t('dashboard:header.subtitle')}
                    </p>
                </div>

                {/* Alerta Importante: Dar Mod al Bot */}
                {botStatus?.botUsername && (
                    <div className="mb-6 bg-ds-warn/5 border border-ds-warn/30 rounded-lg p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-ds-warn/10 rounded-lg flex-shrink-0">
                                <Bot className="w-6 h-6 text-ds-warn" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-black text-ds-text mb-2">
                                    {t('dashboard:botModAlert.title')}
                                </h3>
                                <p className="text-sm text-ds-soft mb-3">
                                    {t('dashboard:botModAlert.description', { botUsername: botStatus.botUsername })}
                                </p>
                                <div className="bg-ds-surface rounded-lg p-3 border border-ds-border">
                                    <p className="text-xs text-ds-soft mb-2">{t('dashboard:botModAlert.instructions')}</p>
                                    <code className="block bg-ds-bg px-3 py-2 rounded text-sm font-mono text-ds-accent-text border border-ds-border">
                                        /mod {botStatus.botUsername}
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Estado del Bot Card */}
                <div className="mb-8">
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-ds-bg border border-ds-border rounded-lg">
                                <Radio className="w-6 h-6 text-ds-accent-text" />
                            </div>
                            {(botStatus?.botConnected && botStatus?.botEnabledForUser) ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-ds-ok rounded-full animate-pulse"></div>
                                    <span className="text-xs font-semibold text-ds-ok">{t('dashboard:botStatus.active')}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-ds-faint rounded-full"></div>
                                    <span className="text-xs font-semibold text-ds-soft">{t('dashboard:botStatus.inactive')}</span>
                                </div>
                            )}
                        </div>
                        <h3 className="text-lg font-black text-ds-text mb-2">
                            {t('dashboard:botStatus.title')}
                        </h3>
                        <p className="text-sm text-ds-soft mb-4">
                            {t('dashboard:botStatus.connectedChannels', { count: botStatus?.connectedChannels || 0 })}
                        </p>
                        <button
                            onClick={() => navigate('/settings')}
                            className="ds-btn ds-btn--secondary ds-btn--block"
                        >
                            <Settings className="w-4 h-4" />
                            {t('dashboard:botStatus.configureButton')}
                        </button>
                    </div>
                </div>

                {/* Main Grid - 4 Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card 1: Botones Rápido */}
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                        <h3 className="text-xl font-black text-ds-text mb-4 flex items-center gap-2">
                            <Zap className="w-6 h-6 text-ds-accent-text" />
                            {t('dashboard:quickButtons.title')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => navigate('/settings')}
                                className="p-4 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left group"
                            >
                                <Settings className="w-5 h-5 text-ds-accent-text mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:quickButtons.settings.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:quickButtons.settings.description')}</p>
                            </button>

                            <button
                                onClick={() => window.open('https://twitch.tv', '_blank')}
                                className="p-4 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left group"
                            >
                                <MessageSquare className="w-5 h-5 text-ds-accent-text mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:quickButtons.twitch.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:quickButtons.twitch.description')}</p>
                            </button>

                            <button
                                onClick={() => window.open('https://dashboard.twitch.tv', '_blank')}
                                className="p-4 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left group"
                            >
                                <TrendingUp className="w-5 h-5 text-ds-accent-text mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:quickButtons.analytics.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:quickButtons.analytics.description')}</p>
                            </button>

                            <button
                                onClick={() => window.open(`/overlay/shoutout?channel=${botStatus?.channels?.[0] || ''}`, '_blank')}
                                className="p-4 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left group"
                                disabled={!botStatus?.channels?.[0]}
                            >
                                <ExternalLink className="w-5 h-5 text-ds-accent-text mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:quickButtons.overlay.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:quickButtons.overlay.description')}</p>
                            </button>
                        </div>
                    </div>

                    {/* Card 2: Comandos */}
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                        <h3 className="text-xl font-black text-ds-text mb-4 flex items-center gap-2">
                            <MessageSquare className="w-6 h-6 text-ds-accent-text" />
                            {t('dashboard:commands.title')}
                        </h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/commands/default')}
                                className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left"
                            >
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:commands.default.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:commands.default.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/commands/microcommands')}
                                className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left"
                            >
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:commands.microcommands.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:commands.microcommands.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/commands/custom')}
                                className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left"
                            >
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:commands.custom.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:commands.custom.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/commands/scripting')}
                                className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left"
                            >
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:commands.scripting.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:commands.scripting.description')}</p>
                            </button>
                        </div>
                    </div>

                    {/* Card 3: Overlays */}
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                        <h3 className="text-xl font-black text-ds-text mb-4 flex items-center gap-2">
                            <Activity className="w-6 h-6 text-ds-accent-text" />
                            {t('dashboard:overlays.title')}
                        </h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/overlays')}
                                className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left"
                            >
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:overlays.viewAll.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:overlays.viewAll.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/overlays/shoutout')}
                                className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left"
                            >
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:overlays.shoutout.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:overlays.shoutout.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/overlays/sound-alerts')}
                                className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left"
                            >
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:overlays.soundAlerts.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:overlays.soundAlerts.description')}</p>
                            </button>
                        </div>
                    </div>

                    {/* Card 4: Funciones */}
                    <div className="bg-ds-surface rounded-lg border border-ds-border p-6">
                        <h3 className="text-xl font-black text-ds-text mb-4 flex items-center gap-2">
                            <Bot className="w-6 h-6 text-ds-accent-text" />
                            {t('dashboard:features.title')}
                        </h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/features/giveaways')}
                                className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left"
                            >
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:features.giveaways.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:features.giveaways.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/followers')}
                                className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left"
                            >
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:features.followers.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:features.followers.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/features/moderation/banned-words')}
                                className="w-full p-3 bg-ds-bg border border-ds-border hover:border-ds-accent rounded-lg transition-colors text-left"
                            >
                                <p className="font-bold text-ds-text text-sm">{t('dashboard:features.bannedWords.title')}</p>
                                <p className="text-xs text-ds-soft mt-1">{t('dashboard:features.bannedWords.description')}</p>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}