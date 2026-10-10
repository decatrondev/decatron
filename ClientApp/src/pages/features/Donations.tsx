/**
 * Donations Dashboard - Vista de donaciones para el streamer owner
 * Muestra estadísticas e historial completo de donaciones recibidas
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    DollarSign, TrendingUp, Users, Clock, Star, Calendar,
    ArrowLeft, RefreshCw, Heart, Award, ChevronRight, AlertCircle
} from 'lucide-react';
import api from '../../services/api';

interface TipStatistics {
    totalAmount: number;
    totalCount: number;
    averageAmount: number;
    largestTip: number;
    topDonor: string | null;
    topDonorTotal: number;
    totalTimeAdded: number;
    formattedTimeAdded: string;
}

interface Donation {
    id: number;
    donorName: string;
    amount: number;
    currency: string;
    message: string | null;
    timeAdded: number;
    donatedAt: string;
}

type Period = 'today' | 'week' | 'month' | 'year' | '';

const PERIOD_LABELS: Record<Period, string> = {
    today: 'Hoy',
    week: 'Esta semana',
    month: 'Este mes',
    year: 'Este año',
    '': 'Todo el tiempo',
};

const CURRENCIES: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', MXN: '$', BRL: 'R$',
    ARS: '$', COP: '$', CLP: '$', PEN: 'S/',
};

function formatCurrency(amount: number, currency = 'USD') {
    const symbol = CURRENCIES[currency] ?? '$';
    return `${symbol}${amount.toFixed(2)}`;
}

function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function timeAgo(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'hace un momento';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    const days = Math.floor(diff / 86400);
    if (days === 1) return 'ayer';
    if (days < 7) return `hace ${days} días`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Donations() {
    const navigate = useNavigate();

    const [period, setPeriod] = useState<Period>('month');
    const [stats, setStats] = useState<TipStatistics | null>(null);
    const [donations, setDonations] = useState<Donation[]>([]);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingDonations, setLoadingDonations] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [limit, setLimit] = useState(50);

    const loadStats = useCallback(async () => {
        setLoadingStats(true);
        try {
            const query = period ? `?period=${period}` : '';
            const res = await api.get(`/tips/statistics${query}`);
            setStats(res.data);
            setError(null);
        } catch {
            setError('Error al cargar estadísticas');
        } finally {
            setLoadingStats(false);
        }
    }, [period]);

    const loadDonations = useCallback(async () => {
        setLoadingDonations(true);
        try {
            const res = await api.get(`/tips/history?limit=${limit}`);
            setDonations(res.data);
        } catch {
            setDonations([]);
        } finally {
            setLoadingDonations(false);
        }
    }, [limit]);

    useEffect(() => { loadStats(); }, [loadStats]);
    useEffect(() => { loadDonations(); }, [loadDonations]);

    const cardBase = 'bg-ds-surface border border-ds-border rounded-lg p-5 ';

    return (
        <div className="space-y-6 max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="ds-btn ds-btn--ghost ds-icon-btn"
                        >
                            <ArrowLeft className="w-5 h-5 text-ds-soft" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-ds-text flex items-center gap-2">
                                <Heart className="w-6 h-6 text-ds-accent-text" />
                                Mis Donaciones
                            </h1>
                            <p className="text-sm text-ds-soft mt-0.5">
                                Historial y estadísticas de tus tips
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Period selector */}
                        <div className="flex items-center gap-1 bg-ds-surface border border-ds-border rounded-lg px-1 py-1">
                            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={period === p ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}
                                >
                                    {PERIOD_LABELS[p]}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => { loadStats(); loadDonations(); }}
                            className="ds-btn ds-btn--ghost ds-icon-btn"
                            title="Actualizar"
                        >
                            <RefreshCw className="w-4 h-4 text-ds-soft" />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-4 bg-ds-danger/10 border border-ds-danger/40 rounded-lg text-ds-danger text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Total recaudado */}
                    <div className={`${cardBase} flex flex-col gap-2`}>
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-ds-ok uppercase tracking-wide">Total</p>
                            <div className="w-8 h-8 rounded-lg bg-ds-ok/10 flex items-center justify-center">
                                <DollarSign className="w-4 h-4 text-ds-accent-text" />
                            </div>
                        </div>
                        {loadingStats ? (
                            <div className="h-8 bg-ds-raised rounded-lg animate-pulse" />
                        ) : (
                            <p className="text-2xl font-black text-ds-ok">
                                {stats ? formatCurrency(stats.totalAmount) : '—'}
                            </p>
                        )}
                        <p className="text-xs text-ds-soft">{PERIOD_LABELS[period]}</p>
                    </div>

                    {/* Donaciones */}
                    <div className={`${cardBase} flex flex-col gap-2`}>
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-ds-accent-text uppercase tracking-wide">Donaciones</p>
                            <div className="w-8 h-8 rounded-lg bg-ds-accent/10 flex items-center justify-center">
                                <Users className="w-4 h-4 text-ds-accent-text" />
                            </div>
                        </div>
                        {loadingStats ? (
                            <div className="h-8 bg-ds-raised rounded-lg animate-pulse" />
                        ) : (
                            <p className="text-2xl font-black text-ds-accent-text">
                                {stats?.totalCount ?? '—'}
                            </p>
                        )}
                        <p className="text-xs text-ds-soft">donantes únicos</p>
                    </div>

                    {/* Promedio */}
                    <div className={`${cardBase} flex flex-col gap-2`}>
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-ds-accent-text uppercase tracking-wide">Promedio</p>
                            <div className="w-8 h-8 rounded-lg bg-ds-accent/10 flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-ds-accent-text" />
                            </div>
                        </div>
                        {loadingStats ? (
                            <div className="h-8 bg-ds-raised rounded-lg animate-pulse" />
                        ) : (
                            <p className="text-2xl font-black text-ds-accent-text">
                                {stats ? formatCurrency(stats.averageAmount) : '—'}
                            </p>
                        )}
                        <p className="text-xs text-ds-soft">por donación</p>
                    </div>

                    {/* Tiempo añadido */}
                    <div className={`${cardBase} flex flex-col gap-2`}>
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-ds-warn uppercase tracking-wide">Tiempo</p>
                            <div className="w-8 h-8 rounded-lg bg-ds-warn/10 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-ds-accent-text" />
                            </div>
                        </div>
                        {loadingStats ? (
                            <div className="h-8 bg-ds-raised rounded-lg animate-pulse" />
                        ) : (
                            <p className="text-2xl font-black text-ds-warn">
                                {stats?.formattedTimeAdded ?? '—'}
                            </p>
                        )}
                        <p className="text-xs text-ds-soft">añadido al timer</p>
                    </div>
                </div>

                {/* Highlights Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Top donante */}
                    {stats?.topDonor && (
                        <div className={`${cardBase} flex items-center gap-4`}>
                            <div className="w-12 h-12 rounded-lg bg-ds-warn/10 flex items-center justify-center shrink-0">
                                <Award className="w-6 h-6 text-ds-accent-text" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-ds-warn uppercase tracking-wide">Top Donante</p>
                                <p className="text-lg font-black text-ds-text truncate">{stats.topDonor}</p>
                                <p className="text-sm text-ds-soft">{formatCurrency(stats.topDonorTotal)} en total</p>
                            </div>
                        </div>
                    )}

                    {/* Mayor donación */}
                    {stats && stats.largestTip > 0 && (
                        <div className={`${cardBase} flex items-center gap-4`}>
                            <div className="w-12 h-12 rounded-lg bg-ds-accent/10 flex items-center justify-center shrink-0">
                                <Star className="w-6 h-6 text-ds-accent-text" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-ds-accent-text uppercase tracking-wide">Mayor Donación</p>
                                <p className="text-lg font-black text-ds-text">{formatCurrency(stats.largestTip)}</p>
                                <p className="text-sm text-ds-soft">{PERIOD_LABELS[period]}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Donation History */}
                <div className={cardBase}>
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-bold text-ds-text flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-ds-accent-text" />
                            Historial de donaciones
                        </h2>
                        <span className="text-sm text-ds-soft">
                            {donations.length} registros
                        </span>
                    </div>

                    {loadingDonations ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-16 bg-ds-raised rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : donations.length === 0 ? (
                        <div className="text-center py-16">
                            <Heart className="w-12 h-12 text-ds-text mx-auto mb-3" />
                            <p className="text-ds-soft font-medium">Aún no hay donaciones registradas</p>
                            <p className="text-sm text-ds-soft mt-1">
                                Comparte tu link de donación para empezar a recibir tips
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                {donations.map((d) => (
                                    <div
                                        key={d.id}
                                        className="flex items-center gap-4 p-4 bg-ds-bg rounded-lg hover:bg-ds-raised transition-colors group"
                                    >
                                        {/* Avatar placeholder */}
                                        <div className="w-10 h-10 rounded-full bg-ds-accent flex items-center justify-center text-ds-on-accent font-bold text-sm shrink-0">
                                            {d.donorName.charAt(0).toUpperCase()}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-ds-text">{d.donorName}</span>
                                                {d.timeAdded > 0 && (
                                                    <span className="text-xs bg-ds-accent/10 text-ds-accent-text px-2 py-0.5 rounded-full font-semibold">
                                                        +{formatTime(d.timeAdded)}
                                                    </span>
                                                )}
                                            </div>
                                            {d.message && (
                                                <p className="text-sm text-ds-soft truncate mt-0.5">
                                                    "{d.message}"
                                                </p>
                                            )}
                                        </div>

                                        {/* Amount + Date */}
                                        <div className="text-right shrink-0">
                                            <p className="text-lg font-black text-ds-ok">
                                                {formatCurrency(d.amount, d.currency)}
                                            </p>
                                            <p className="text-xs text-ds-soft">{timeAgo(d.donatedAt)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Load more */}
                            {donations.length >= limit && (
                                <button
                                    onClick={() => setLimit(l => l + 50)}
                                    className="mt-4 w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold text-ds-accent-text hover:bg-ds-accent/10 rounded-lg transition-colors"
                                >
                                    Cargar más
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Quick link to config */}
                <div className={`${cardBase} flex items-center justify-between`}>
                    <div>
                        <p className="font-semibold text-ds-text">Configurar donaciones</p>
                        <p className="text-sm text-ds-soft">
                            Ajusta tu página de donación, alertas y timer
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/features/tips')}
                        className="ds-btn ds-btn--primary"
                    >
                        Configurar
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

        </div>
    );
}
