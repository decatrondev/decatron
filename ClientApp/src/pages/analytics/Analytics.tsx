import TabIcon from '../../components/dashboard/TabIcon';
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
        <div className="panel-scale space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="ds-btn ds-btn--ghost ds-icon-btn"
                    >
                        <ArrowLeft className="w-5 h-5 text-ds-soft" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-ds-text">
                            {t('title', 'Analytics')}
                        </h1>
                        <p className="text-sm text-ds-soft">
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
                        className="ds-btn ds-btn--secondary ds-icon-btn"
                        title={t('refresh', 'Actualizar')}
                    >
                        <RefreshCw className={`w-4 h-4 text-ds-soft ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="relative group">
                        <button
                            onClick={exportCSV}
                            className="ds-btn ds-btn--primary"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('exportCSV', 'Exportar CSV')}</span>
                        </button>
                        {/* Tooltip */}
                        <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-ds-surface border border-ds-border rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                            <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-ds-accent-text flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-semibold text-ds-text mb-1">
                                        {t('csvIncludes', 'El CSV incluye:')}
                                    </p>
                                    <ul className="text-xs text-ds-soft space-y-0.5">
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
                <div className="bg-ds-danger/10 border border-ds-danger/40 text-ds-danger rounded-lg p-4">
                    {error}
                </div>
            )}

            {/* Tabs */}
            <div className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
                {/* Tab List */}
                <div className="flex border-b border-ds-border overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px
                                ${activeTab === tab.id
                                    ? 'border-ds-accent text-ds-accent-text bg-ds-accent/10 '
                                    : 'border-transparent text-ds-soft hover:text-ds-text hover:bg-ds-bg '
                                }`}
                        >
                            <TabIcon emoji={tab.icon} />
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
