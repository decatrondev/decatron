import { useEffect, useState, useCallback } from 'react';
import { Trophy, Medal } from 'lucide-react';
import api from '../../../../services/api';

interface TopDonor {
    rank: number;
    donorName: string;
    totalAmount: number;
    donationCount: number;
    averageAmount: number;
    lastDonation: string;
}

interface Props {
    period: string;
    refreshKey: number;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', MXN: '$', BRL: 'R$',
    ARS: '$', COP: '$', CLP: '$', PEN: 'S/',
};

function fmt(amount: number) {
    const sym = CURRENCY_SYMBOLS['USD'];
    return `${sym}${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(str: string) {
    return new Date(str).toLocaleDateString('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

const RANK_STYLES: Record<number, { bg: string; text: string; icon: React.ReactNode }> = {
    1: {
        bg: 'bg-ds-warn/10 ',
        text: 'text-ds-warn ',
        icon: <Trophy className="w-4 h-4" />,
    },
    2: {
        bg: 'bg-ds-bg ',
        text: 'text-ds-soft ',
        icon: <Medal className="w-4 h-4" />,
    },
    3: {
        bg: 'bg-ds-warn/10 ',
        text: 'text-ds-warn ',
        icon: <Medal className="w-4 h-4" />,
    },
};

export function TopDonors({ period, refreshKey }: Props) {
    const [donors, setDonors] = useState<TopDonor[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const query = period ? `?period=${period}&limit=20` : '?limit=20';
            const res = await api.get<TopDonor[]>(`/tips/top-donors${query}`);
            setDonors(res.data);
        } catch {
            setDonors([]);
        } finally {
            setLoading(false);
        }
    }, [period, refreshKey]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className="bg-ds-surface border border-ds-border rounded-lg overflow-hidden">
                <div className="space-y-0">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-ds-border last:border-0">
                            <div className="w-10 h-10 rounded-full bg-ds-raised animate-pulse shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-ds-raised rounded animate-pulse w-32" />
                                <div className="h-3 bg-ds-raised rounded animate-pulse w-20" />
                            </div>
                            <div className="h-6 bg-ds-raised rounded animate-pulse w-16" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (donors.length === 0) {
        return (
            <div className="bg-ds-surface border border-ds-border rounded-lg p-12 text-center">
                <Trophy className="w-12 h-12 text-ds-text mx-auto mb-3" />
                <p className="text-ds-soft font-medium">Aún no hay donantes en este período</p>
            </div>
        );
    }

    return (
        <div className="bg-ds-surface border border-ds-border rounded-lg overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-ds-border bg-ds-bg">
                <div className="col-span-1 text-xs font-bold text-ds-soft uppercase tracking-wide">#</div>
                <div className="col-span-4 text-xs font-bold text-ds-soft uppercase tracking-wide">Donante</div>
                <div className="col-span-2 text-right text-xs font-bold text-ds-soft uppercase tracking-wide">Total</div>
                <div className="col-span-2 text-center text-xs font-bold text-ds-soft uppercase tracking-wide hidden md:block">Donaciones</div>
                <div className="col-span-2 text-right text-xs font-bold text-ds-soft uppercase tracking-wide hidden lg:block">Promedio</div>
                <div className="col-span-1 text-right text-xs font-bold text-ds-soft uppercase tracking-wide hidden xl:block">Última</div>
            </div>

            {/* Rows */}
            {donors.map((d) => {
                const rankStyle = RANK_STYLES[d.rank];
                return (
                    <div
                        key={d.rank}
                        className="grid grid-cols-12 gap-4 items-center px-6 py-4 border-b border-ds-border last:border-0 hover:bg-ds-bg transition-colors"
                    >
                        {/* Rank badge */}
                        <div className="col-span-1">
                            {rankStyle ? (
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${rankStyle.bg} ${rankStyle.text}`}>
                                    {d.rank <= 3 ? rankStyle.icon : d.rank}
                                </div>
                            ) : (
                                <span className="text-sm font-bold text-ds-soft pl-1">{d.rank}</span>
                            )}
                        </div>

                        {/* Name + avatar */}
                        <div className="col-span-4 flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-ds-accent flex items-center justify-center text-ds-on-accent text-sm font-bold shrink-0">
                                {d.donorName.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-ds-text truncate">
                                {d.donorName}
                            </span>
                        </div>

                        {/* Total */}
                        <div className="col-span-2 text-right font-black text-ds-ok">
                            {fmt(d.totalAmount)}
                        </div>

                        {/* Count */}
                        <div className="col-span-2 text-center hidden md:block">
                            <span className="text-sm font-semibold text-ds-soft">
                                {d.donationCount}
                            </span>
                        </div>

                        {/* Average */}
                        <div className="col-span-2 text-right hidden lg:block">
                            <span className="text-sm text-ds-soft">
                                {fmt(d.averageAmount)}
                            </span>
                        </div>

                        {/* Last donation */}
                        <div className="col-span-1 text-right hidden xl:block">
                            <span className="text-xs text-ds-soft whitespace-nowrap">
                                {fmtDate(d.lastDonation)}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
