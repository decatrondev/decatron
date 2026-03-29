import { DollarSign, TrendingUp, Users, Clock, Award, Star } from 'lucide-react';

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

interface Props {
    stats: Stats | null;
    loading: boolean;
    currency?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', MXN: '$', BRL: 'R$',
    ARS: '$', COP: '$', CLP: '$', PEN: 'S/',
};

function fmt(amount: number, currency = 'USD') {
    const sym = CURRENCY_SYMBOLS[currency] ?? '$';
    return `${sym}${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Skeleton() {
    return <div className="h-8 bg-[#e2e8f0] dark:bg-[#262626] rounded-lg animate-pulse" />;
}

export function StatsGrid({ stats, loading, currency = 'USD' }: Props) {
    const cards = [
        {
            label: 'Total recaudado',
            value: stats ? fmt(stats.totalAmount, currency) : '—',
            sub: 'en el período',
            icon: <DollarSign className="w-4 h-4" />,
            color: 'green',
        },
        {
            label: 'Donaciones',
            value: stats?.totalCount ?? '—',
            sub: 'transacciones',
            icon: <Users className="w-4 h-4" />,
            color: 'blue',
        },
        {
            label: 'Promedio',
            value: stats ? fmt(stats.averageAmount, currency) : '—',
            sub: 'por donación',
            icon: <TrendingUp className="w-4 h-4" />,
            color: 'purple',
        },
        {
            label: 'Mayor donación',
            value: stats ? fmt(stats.largestTip, currency) : '—',
            sub: 'récord del período',
            icon: <Star className="w-4 h-4" />,
            color: 'pink',
        },
        {
            label: 'Tiempo al timer',
            value: stats?.formattedTimeAdded ?? '—',
            sub: 'añadido en total',
            icon: <Clock className="w-4 h-4" />,
            color: 'orange',
        },
    ];

    const colorMap: Record<string, string> = {
        green:  'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
        blue:   'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
        purple: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
        pink:   'text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30',
        orange: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
    };

    const valueColorMap: Record<string, string> = {
        green:  'text-green-700 dark:text-green-300',
        blue:   'text-blue-700 dark:text-blue-300',
        purple: 'text-purple-700 dark:text-purple-300',
        pink:   'text-pink-700 dark:text-pink-300',
        orange: 'text-orange-700 dark:text-orange-300',
    };

    return (
        <div className="space-y-4">
            {/* 5 stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                {cards.map((c) => (
                    <div
                        key={c.label}
                        className="bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4 shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-[#64748b] dark:text-[#94a3b8] uppercase tracking-wide">
                                {c.label}
                            </p>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${colorMap[c.color]}`}>
                                {c.icon}
                            </div>
                        </div>
                        {loading ? (
                            <Skeleton />
                        ) : (
                            <p className={`text-2xl font-black ${valueColorMap[c.color]}`}>{c.value}</p>
                        )}
                        <p className="text-xs text-[#94a3b8] mt-1">{c.sub}</p>
                    </div>
                ))}
            </div>

            {/* Top donor highlight */}
            {!loading && stats?.topDonor && (
                <div className="bg-white dark:bg-[#1B1C1D] border border-[#e2e8f0] dark:border-[#374151] rounded-2xl p-4 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0">
                        <Award className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">
                            Top donante del período
                        </p>
                        <p className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc] truncate">
                            {stats.topDonor}
                        </p>
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {fmt(stats.topDonorTotal, currency)} en total
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
