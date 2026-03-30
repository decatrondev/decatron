/**
 * Admin Donations Dashboard
 * Vista exclusiva del owner para ver analíticas, historial y top donantes
 */

import { useState, useEffect, useCallback } from 'react';
import { Heart, BarChart3, List, Trophy, RefreshCw, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { StatsGrid } from './components/StatsGrid';
import { DonationHistory } from './components/DonationHistory';
import { TopDonors } from './components/TopDonors';

interface Stats {
    totalAmount: number;
    totalCount: number;
    averageAmount: number;
    largestTip: number;
    topDonor: string | null;
    topDonorTotal: number;
    totalTimeAdded: number;
    formattedTimeAdded: string;
}

type Period = 'today' | 'week' | 'month' | 'year' | '';
type Tab = 'analytics' | 'history' | 'top';

export default function AdminDonations() {
    const navigate = useNavigate();
    const { t } = useTranslation('features');

    const PERIOD_LABELS: Record<Period, string> = {
        today: t('donations.periods.today'),
        week: t('donations.periods.week'),
        month: t('donations.periods.month'),
        year: t('donations.periods.year'),
        '': t('donations.periods.all'),
    };

    const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: 'analytics', label: t('donations.tabs.analytics'), icon: <BarChart3 className="w-4 h-4" /> },
        { id: 'history',   label: t('donations.tabs.history'),  icon: <List className="w-4 h-4" /> },
        { id: 'top',       label: t('donations.tabs.topDonors'), icon: <Trophy className="w-4 h-4" /> },
    ];
    const [tab, setTab] = useState<Tab>('analytics');
    const [period, setPeriod] = useState<Period>('month');
    const [stats, setStats] = useState<Stats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    const loadStats = useCallback(async () => {
        setLoadingStats(true);
        try {
            const query = period ? `?period=${period}` : '';
            const res = await api.get<Stats>(`/tips/statistics${query}`);
            setStats(res.data);
        } catch {
            setStats(null);
        } finally {
            setLoadingStats(false);
        }
    }, [period, refreshKey]);

    useEffect(() => { loadStats(); }, [loadStats]);

    const refresh = () => setRefreshKey(k => k + 1);

    const cardClass = 'rounded-2xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] p-6 shadow-sm';

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-pink-600 dark:text-pink-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc]">
                            {t('donations.title')}
                        </h1>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {t('donations.subtitle')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Period selector */}
                    <div className="flex items-center bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl p-1 gap-0.5">
                        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                    period === p
                                        ? 'bg-purple-600 text-white shadow-sm'
                                        : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-white dark:hover:bg-[#374151]'
                                }`}
                            >
                                {PERIOD_LABELS[p]}
                            </button>
                        ))}
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={refresh}
                        title={t('donations.refresh')}
                        className="p-2 rounded-xl border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] hover:bg-[#f8fafc] dark:hover:bg-[#374151] transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                    </button>

                    {/* Go to tips config */}
                    <button
                        onClick={() => navigate('/features/tips')}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-semibold border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#262626] hover:bg-[#f8fafc] dark:hover:bg-[#374151] text-[#64748b] dark:text-[#94a3b8] rounded-xl transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                        {t('donations.configureTips')}
                    </button>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-1 border-b border-[#e2e8f0] dark:border-[#374151]">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
                            tab === t.id
                                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-[#64748b] dark:text-[#94a3b8] hover:text-[#1e293b] dark:hover:text-[#f8fafc]'
                        }`}
                    >
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Tab: Analíticas ── */}
            {tab === 'analytics' && (
                <StatsGrid stats={stats} loading={loadingStats} />
            )}

            {/* ── Tab: Historial ── */}
            {tab === 'history' && (
                <DonationHistory refreshKey={refreshKey} />
            )}

            {/* ── Tab: Top Donantes ── */}
            {tab === 'top' && (
                <div className="space-y-4">
                    <div className={cardClass}>
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-yellow-500" />
                                {t('donations.donorRanking')}
                            </h2>
                            <span className="text-sm text-[#94a3b8]">
                                {PERIOD_LABELS[period]}
                            </span>
                        </div>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mb-5">
                            {t('donations.top20')}
                        </p>
                        <TopDonors period={period} refreshKey={refreshKey} />
                    </div>
                </div>
            )}

        </div>
    );
}
