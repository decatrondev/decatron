import { useState } from 'react';
import { ArrowLeft, Download, RefreshCw, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import OverviewTab from './tabs/OverviewTab';
import TimerEventsTab from './tabs/TimerEventsTab';
import ModerationTab from './tabs/ModerationTab';
import StreamHistoryTab from './tabs/StreamHistoryTab';
import ActivityTab from './tabs/ActivityTab';
import ChatMessagesTab from './tabs/ChatMessagesTab';
import DateRangeSelector from './components/DateRangeSelector';
import { useAnalytics } from './hooks/useAnalytics';

export default function Analytics() {
    const { t } = useTranslation('analytics');
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        to: new Date()
    });

    const { data, isLoading, error, refetch, exportCSV } = useAnalytics(dateRange);

    const tabs = [
        { id: 'overview', name: t('tabs.overview', 'Overview'), icon: '📊' },
        { id: 'timer', name: t('tabs.timerEvents', 'Timer Events'), icon: '⏱️' },
        { id: 'moderation', name: t('tabs.moderation', 'Moderación'), icon: '🛡️' },
        { id: 'stream', name: t('tabs.streamHistory', 'Stream History'), icon: '🎮' },
        { id: 'chat', name: t('tabs.chatMessages', 'Chat'), icon: '💬' },
        { id: 'activity', name: t('tabs.activity', 'Actividad'), icon: '📈' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="p-2 hover:bg-[#f8fafc] dark:hover:bg-[#262626] rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                            {t('title', 'Analytics')}
                        </h1>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {t('subtitle', 'Estadísticas y logs de tu canal')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <DateRangeSelector
                        value={dateRange}
                        onChange={setDateRange}
                        maxDays={data?.meta?.maxDaysAllowed || 30}
                    />
                    <button
                        onClick={refetch}
                        disabled={isLoading}
                        className="p-2.5 bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg hover:bg-white dark:hover:bg-[#1B1C1D] transition-colors"
                        title={t('refresh', 'Actualizar')}
                    >
                        <RefreshCw className={`w-4 h-4 text-[#64748b] dark:text-[#94a3b8] ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="relative group">
                        <button
                            onClick={exportCSV}
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8] transition-colors font-semibold text-sm"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('exportCSV', 'Exportar CSV')}</span>
                        </button>
                        {/* Tooltip */}
                        <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-white dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                            <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-[#2563eb] flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-semibold text-[#1e293b] dark:text-[#f8fafc] mb-1">
                                        {t('csvIncludes', 'El CSV incluye:')}
                                    </p>
                                    <ul className="text-xs text-[#64748b] dark:text-[#94a3b8] space-y-0.5">
                                        <li>• {t('csvTimer', 'Eventos del Timer (follows, subs, bits, etc.)')}</li>
                                        <li>• {t('csvModeration', 'Acciones de Moderación')}</li>
                                        <li>• {t('csvHistory', 'Historial de Juegos y Títulos')}</li>
                                        <li>• {t('csvChat', 'Mensajes de Chat')}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl p-4">
                    {error}
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white dark:bg-[#1B1C1D] rounded-2xl border border-[#e2e8f0] dark:border-[#374151] shadow-lg overflow-hidden">
                {/* Tab List */}
                <div className="flex border-b border-[#e2e8f0] dark:border-[#374151] overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px
                                ${activeTab === tab.id
                                    ? 'border-[#2563eb] text-[#2563eb] bg-blue-50/50 dark:bg-blue-900/10'
                                    : 'border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-[#f8fafc] hover:bg-[#f8fafc] dark:hover:bg-[#262626]'
                                }`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.name}</span>
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'overview' && (
                        <OverviewTab data={data?.overview} isLoading={isLoading} />
                    )}
                    {activeTab === 'timer' && (
                        <TimerEventsTab data={data?.timerEvents} isLoading={isLoading} dateRange={dateRange} />
                    )}
                    {activeTab === 'moderation' && (
                        <ModerationTab data={data?.moderation} isLoading={isLoading} dateRange={dateRange} />
                    )}
                    {activeTab === 'stream' && (
                        <StreamHistoryTab data={data?.streamHistory} isLoading={isLoading} dateRange={dateRange} />
                    )}
                    {activeTab === 'chat' && (
                        <ChatMessagesTab data={data?.chatMessages} isLoading={isLoading} dateRange={dateRange} />
                    )}
                    {activeTab === 'activity' && (
                        <ActivityTab data={data?.activity} isLoading={isLoading} dateRange={dateRange} />
                    )}
                </div>
            </div>
        </div>
    );
}
