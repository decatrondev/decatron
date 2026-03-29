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

    const cardBase = 'bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-5 shadow-sm';

    return (
        <div className="space-y-6 max-w-6xl mx-auto">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 rounded-xl hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-[#64748b] dark:text-[#94a3b8]" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                                <Heart className="w-6 h-6 text-pink-500" />
                                Mis Donaciones
                            </h1>
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                                Historial y estadísticas de tus tips
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Period selector */}
                        <div className="flex items-center gap-1 bg-white dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151] rounded-xl px-1 py-1">
                            {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                                        period === p
                                            ? 'bg-purple-600 text-white shadow-sm'
                                            : 'text-[#64748b] dark:text-[#94a3b8] hover:bg-[#f1f5f9] dark:hover:bg-[#374151]'
                                    }`}
                                >
                                    {PERIOD_LABELS[p]}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => { loadStats(); loadDonations(); }}
                            className="p-2 rounded-xl hover:bg-[#e2e8f0] dark:hover:bg-[#374151] transition-colors"
                            title="Actualizar"
                        >
                            <RefreshCw className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Total recaudado */}
                    <div className={`${cardBase} flex flex-col gap-2`}>
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Total</p>
                            <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                        {loadingStats ? (
                            <div className="h-8 bg-[#e2e8f0] dark:bg-[#262626] rounded-lg animate-pulse" />
                        ) : (
                            <p className="text-2xl font-black text-green-700 dark:text-green-300">
                                {stats ? formatCurrency(stats.totalAmount) : '—'}
                            </p>
                        )}
                        <p className="text-xs text-[#94a3b8]">{PERIOD_LABELS[period]}</p>
                    </div>

                    {/* Donaciones */}
                    <div className={`${cardBase} flex flex-col gap-2`}>
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Donaciones</p>
                            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                        {loadingStats ? (
                            <div className="h-8 bg-[#e2e8f0] dark:bg-[#262626] rounded-lg animate-pulse" />
                        ) : (
                            <p className="text-2xl font-black text-blue-700 dark:text-blue-300">
                                {stats?.totalCount ?? '—'}
                            </p>
                        )}
                        <p className="text-xs text-[#94a3b8]">donantes únicos</p>
                    </div>

                    {/* Promedio */}
                    <div className={`${cardBase} flex flex-col gap-2`}>
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Promedio</p>
                            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                        </div>
                        {loadingStats ? (
                            <div className="h-8 bg-[#e2e8f0] dark:bg-[#262626] rounded-lg animate-pulse" />
                        ) : (
                            <p className="text-2xl font-black text-purple-700 dark:text-purple-300">
                                {stats ? formatCurrency(stats.averageAmount) : '—'}
                            </p>
                        )}
                        <p className="text-xs text-[#94a3b8]">por donación</p>
                    </div>

                    {/* Tiempo añadido */}
                    <div className={`${cardBase} flex flex-col gap-2`}>
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">Tiempo</p>
                            <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            </div>
                        </div>
                        {loadingStats ? (
                            <div className="h-8 bg-[#e2e8f0] dark:bg-[#262626] rounded-lg animate-pulse" />
                        ) : (
                            <p className="text-2xl font-black text-orange-700 dark:text-orange-300">
                                {stats?.formattedTimeAdded ?? '—'}
                            </p>
                        )}
                        <p className="text-xs text-[#94a3b8]">añadido al timer</p>
                    </div>
                </div>

                {/* Highlights Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Top donante */}
                    {stats?.topDonor && (
                        <div className={`${cardBase} flex items-center gap-4`}>
                            <div className="w-12 h-12 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0">
                                <Award className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">Top Donante</p>
                                <p className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc] truncate">{stats.topDonor}</p>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{formatCurrency(stats.topDonorTotal)} en total</p>
                            </div>
                        </div>
                    )}

                    {/* Mayor donación */}
                    {stats && stats.largestTip > 0 && (
                        <div className={`${cardBase} flex items-center gap-4`}>
                            <div className="w-12 h-12 rounded-2xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center shrink-0">
                                <Star className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wide">Mayor Donación</p>
                                <p className="text-lg font-black text-[#1e293b] dark:text-[#f8fafc]">{formatCurrency(stats.largestTip)}</p>
                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">{PERIOD_LABELS[period]}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Donation History */}
                <div className={cardBase}>
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-purple-500" />
                            Historial de donaciones
                        </h2>
                        <span className="text-sm text-[#94a3b8]">
                            {donations.length} registros
                        </span>
                    </div>

                    {loadingDonations ? (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="h-16 bg-[#e2e8f0] dark:bg-[#262626] rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : donations.length === 0 ? (
                        <div className="text-center py-16">
                            <Heart className="w-12 h-12 text-[#e2e8f0] dark:text-[#374151] mx-auto mb-3" />
                            <p className="text-[#94a3b8] font-medium">Aún no hay donaciones registradas</p>
                            <p className="text-sm text-[#94a3b8] mt-1">
                                Comparte tu link de donación para empezar a recibir tips
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                {donations.map((d) => (
                                    <div
                                        key={d.id}
                                        className="flex items-center gap-4 p-4 bg-[#f8fafc] dark:bg-[#262626] rounded-xl hover:bg-[#f1f5f9] dark:hover:bg-[#374151] transition-colors group"
                                    >
                                        {/* Avatar placeholder */}
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                            {d.donorName.charAt(0).toUpperCase()}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{d.donorName}</span>
                                                {d.timeAdded > 0 && (
                                                    <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-semibold">
                                                        +{formatTime(d.timeAdded)}
                                                    </span>
                                                )}
                                            </div>
                                            {d.message && (
                                                <p className="text-sm text-[#64748b] dark:text-[#94a3b8] truncate mt-0.5">
                                                    "{d.message}"
                                                </p>
                                            )}
                                        </div>

                                        {/* Amount + Date */}
                                        <div className="text-right shrink-0">
                                            <p className="text-lg font-black text-green-600 dark:text-green-400">
                                                {formatCurrency(d.amount, d.currency)}
                                            </p>
                                            <p className="text-xs text-[#94a3b8]">{timeAgo(d.donatedAt)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Load more */}
                            {donations.length >= limit && (
                                <button
                                    onClick={() => setLimit(l => l + 50)}
                                    className="mt-4 w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl transition-colors"
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
                        <p className="font-semibold text-[#1e293b] dark:text-[#f8fafc]">Configurar donaciones</p>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Ajusta tu página de donación, alertas y timer
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/features/tips')}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        Configurar
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

        </div>
    );
}
