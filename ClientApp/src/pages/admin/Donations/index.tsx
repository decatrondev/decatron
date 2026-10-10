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

    const cardClass = 'rounded-lg border border-ds-border bg-ds-surface p-6 ';

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-ds-accent/10 flex items-center justify-center">
                        <Heart className="w-5 h-5 text-ds-accent-text" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-ds-text">
                            {t('donations.title')}
                        </h1>
                        <p className="text-sm text-ds-soft">
                            {t('donations.subtitle')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Period selector */}
                    <div className="flex items-center bg-ds-bg border border-ds-border rounded-lg p-1 gap-0.5">
                        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                    period === p
                                        ? 'bg-ds-accent text-ds-on-accent '
                                        : 'text-ds-soft hover:bg-ds-surface '
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
                        className="p-2 rounded-lg border border-ds-border bg-ds-surface hover:bg-ds-bg transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 text-ds-soft" />
                    </button>

                    {/* Go to tips config */}
                    <button
                        onClick={() => navigate('/features/tips')}
                        className="ds-btn ds-btn--secondary"
                    >
                        <ExternalLink className="w-4 h-4" />
                        {t('donations.configureTips')}
                    </button>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-1 border-b border-ds-border">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
                            tab === t.id
                                ? 'border-ds-accent text-ds-accent-text '
                                : 'border-transparent text-ds-soft hover:text-ds-text '
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
                            <h2 className="font-bold text-ds-text flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-ds-accent-text" />
                                {t('donations.donorRanking')}
                            </h2>
                            <span className="text-sm text-ds-soft">
                                {PERIOD_LABELS[period]}
                            </span>
                        </div>
                        <p className="text-sm text-ds-soft mb-5">
                            {t('donations.top20')}
                        </p>
                        <TopDonors period={period} refreshKey={refreshKey} />
                    </div>
                </div>
            )}

        </div>
    );
}
