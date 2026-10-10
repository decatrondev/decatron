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
    return <div className="h-8 bg-ds-raised rounded-lg animate-pulse" />;
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
        green: 'text-ds-ok bg-ds-ok/10 ',
        blue: 'text-ds-accent-text bg-ds-accent/10 ',
        purple: 'text-ds-accent-text bg-ds-accent/10 ',
        pink: 'text-ds-accent-text bg-ds-accent/10 ',
        orange: 'text-ds-warn bg-ds-warn/10 ',
    };

    const valueColorMap: Record<string, string> = {
        green: 'text-ds-ok ',
        blue: 'text-ds-accent-text ',
        purple: 'text-ds-accent-text ',
        pink: 'text-ds-accent-text ',
        orange: 'text-ds-warn ',
    };

    return (
        <div className="space-y-4">
            {/* 5 stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                {cards.map((c) => (
                    <div
                        key={c.label}
                        className="bg-ds-surface border border-ds-border rounded-lg p-4"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-semibold text-ds-soft uppercase tracking-wide">
                                {c.label}
                            </p>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[c.color]}`}>
                                {c.icon}
                            </div>
                        </div>
                        {loading ? (
                            <Skeleton />
                        ) : (
                            <p className={`text-2xl font-black ${valueColorMap[c.color]}`}>{c.value}</p>
                        )}
                        <p className="text-xs text-ds-soft mt-1">{c.sub}</p>
                    </div>
                ))}
            </div>

            {/* Top donor highlight */}
            {!loading && stats?.topDonor && (
                <div className="bg-ds-surface border border-ds-border rounded-lg p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-ds-warn/10 flex items-center justify-center shrink-0">
                        <Award className="w-6 h-6 text-ds-accent-text" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-ds-warn uppercase tracking-wide">
                            Top donante del período
                        </p>
                        <p className="text-xl font-black text-ds-text truncate">
                            {stats.topDonor}
                        </p>
                        <p className="text-sm text-ds-soft">
                            {fmt(stats.topDonorTotal, currency)} en total
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
