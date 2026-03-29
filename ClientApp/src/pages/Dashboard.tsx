import { useEffect, useState } from 'react';
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
    Activity
} from 'lucide-react';
import api from '../services/api';

export default function Dashboard() {
    const { t } = useTranslation(['dashboard', 'common']);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [botStatus, setBotStatus] = useState<any>(null);

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
        if (!isLoading) {
            loadBotStatus();
        }
    }, [isLoading]);

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
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#1B1C1D]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2563eb] mx-auto mb-4"></div>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">{t('dashboard:loading')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#1B1C1D] p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">
                        {t('dashboard:header.title')}
                    </h1>
                    <p className="text-[#64748b] dark:text-[#94a3b8]">
                        {t('dashboard:header.subtitle')}
                    </p>
                </div>

                {/* Alerta Importante: Dar Mod al Bot */}
                {botStatus?.botUsername && (
                    <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex-shrink-0">
                                <Bot className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-black text-amber-900 dark:text-amber-100 mb-2">
                                    {t('dashboard:botModAlert.title')}
                                </h3>
                                <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                                    {t('dashboard:botModAlert.description', { botUsername: botStatus.botUsername })}
                                </p>
                                <div className="bg-white dark:bg-[#1B1C1D] rounded-lg p-3 border border-amber-200 dark:border-amber-700">
                                    <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mb-2">{t('dashboard:botModAlert.instructions')}</p>
                                    <code className="block bg-[#f8fafc] dark:bg-[#0f1011] px-3 py-2 rounded text-sm font-mono text-[#2563eb] dark:text-[#60a5fa] border border-[#e2e8f0] dark:border-[#374151]">
                                        /mod {botStatus.botUsername}
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Estado del Bot Card */}
                <div className="mb-8">
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                                <Radio className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            {(botStatus?.botConnected && botStatus?.botEnabledForUser) ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">{t('dashboard:botStatus.active')}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                    <span className="text-xs font-semibold text-gray-500">{t('dashboard:botStatus.inactive')}</span>
                                </div>
                            )}
                        </div>
                        <h3 className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] mb-2">
                            {t('dashboard:botStatus.title')}
                        </h3>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-4">
                            {t('dashboard:botStatus.connectedChannels', { count: botStatus?.connectedChannels || 0 })}
                        </p>
                        <button
                            onClick={() => navigate('/settings')}
                            className="w-full px-4 py-2 bg-[#f1f5f9] dark:bg-[#262626] hover:bg-[#e2e8f0] dark:hover:bg-[#333] text-[#1e293b] dark:text-[#f8fafc] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            {t('dashboard:botStatus.configureButton')}
                        </button>
                    </div>
                </div>

                {/* Main Grid - 4 Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card 1: Botones Rápido */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                            <Zap className="w-6 h-6 text-[#2563eb]" />
                            {t('dashboard:quickButtons.title')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => navigate('/settings')}
                                className="p-4 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left group"
                            >
                                <Settings className="w-5 h-5 text-[#2563eb] mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:quickButtons.settings.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:quickButtons.settings.description')}</p>
                            </button>

                            <button
                                onClick={() => window.open('https://twitch.tv', '_blank')}
                                className="p-4 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left group"
                            >
                                <MessageSquare className="w-5 h-5 text-green-600 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:quickButtons.twitch.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:quickButtons.twitch.description')}</p>
                            </button>

                            <button
                                onClick={() => window.open('https://dashboard.twitch.tv', '_blank')}
                                className="p-4 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left group"
                            >
                                <TrendingUp className="w-5 h-5 text-orange-600 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:quickButtons.analytics.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:quickButtons.analytics.description')}</p>
                            </button>

                            <button
                                onClick={() => window.open(`/overlay/shoutout?channel=${botStatus?.channels?.[0] || ''}`, '_blank')}
                                className="p-4 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left group"
                                disabled={!botStatus?.channels?.[0]}
                            >
                                <ExternalLink className="w-5 h-5 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:quickButtons.overlay.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:quickButtons.overlay.description')}</p>
                            </button>
                        </div>
                    </div>

                    {/* Card 2: Comandos */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                            <MessageSquare className="w-6 h-6 text-green-600" />
                            {t('dashboard:commands.title')}
                        </h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/commands/default')}
                                className="w-full p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left"
                            >
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:commands.default.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:commands.default.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/commands/microcommands')}
                                className="w-full p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left"
                            >
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:commands.microcommands.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:commands.microcommands.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/commands/custom')}
                                className="w-full p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left"
                            >
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:commands.custom.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:commands.custom.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/commands/scripting')}
                                className="w-full p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left"
                            >
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:commands.scripting.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:commands.scripting.description')}</p>
                            </button>
                        </div>
                    </div>

                    {/* Card 3: Overlays */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                            <Activity className="w-6 h-6 text-purple-600" />
                            {t('dashboard:overlays.title')}
                        </h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/overlays')}
                                className="w-full p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left"
                            >
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:overlays.viewAll.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:overlays.viewAll.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/overlays/shoutout')}
                                className="w-full p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left"
                            >
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:overlays.shoutout.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:overlays.shoutout.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/features/sound-alerts')}
                                className="w-full p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left"
                            >
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:overlays.soundAlerts.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:overlays.soundAlerts.description')}</p>
                            </button>
                        </div>
                    </div>

                    {/* Card 4: Funciones */}
                    <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] p-6 shadow-lg">
                        <h3 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] mb-4 flex items-center gap-2">
                            <Bot className="w-6 h-6 text-orange-600" />
                            {t('dashboard:features.title')}
                        </h3>
                        <div className="space-y-3">
                            <button
                                onClick={() => navigate('/features/giveaways')}
                                className="w-full p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left"
                            >
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:features.giveaways.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:features.giveaways.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/followers')}
                                className="w-full p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left"
                            >
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:features.followers.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:features.followers.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/features/follow-alerts')}
                                className="w-full p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left"
                            >
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:features.followAlerts.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:features.followAlerts.description')}</p>
                            </button>

                            <button
                                onClick={() => navigate('/features/moderation/banned-words')}
                                className="w-full p-3 bg-[#f8fafc] dark:bg-[#262626] hover:bg-[#f1f5f9] dark:hover:bg-[#333] rounded-xl transition-colors text-left"
                            >
                                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{t('dashboard:features.bannedWords.title')}</p>
                                <p className="text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{t('dashboard:features.bannedWords.description')}</p>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}