import { Check, X } from 'lucide-react';
import { type Delivery, type Prize } from '../model';

/// La bandeja de entregas pendientes: lo que el bot no pudo entregar solo y espera
/// al streamer. El motivo lo escribe el bot, para que se vea si hay algo que
/// arreglar (el bot no es mod, el timer estaba detenido) o solo hay que cumplirlo.
export function DeliveriesTab({ deliveries, filter, onFilter, onResolve, t }: {
    deliveries: Delivery[];
    filter: 'pending' | 'all';
    onFilter: (f: 'pending' | 'all') => void;
    onResolve: (id: number, status: 'done' | 'cancelled' | 'pending') => void;
    t: any;
}) {
    return (
        <section className="bg-[#1B1C1D] rounded-xl border border-[#374151] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#374151] flex items-center justify-between gap-4">
                <div>
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.deliveries.title')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.deliveries.help')}</p>
                </div>
                <div className="flex gap-1 bg-[#262626] rounded-lg p-1 flex-shrink-0">
                    {(['pending', 'all'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => onFilter(f)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                                filter === f ? 'bg-blue-600 text-white' : 'text-[#94a3b8] hover:text-[#f8fafc]'
                            }`}
                        >
                            {t(`wheel.deliveries.filter_${f}`)}
                        </button>
                    ))}
                </div>
            </div>

            {deliveries.length === 0 ? (
                <p className="px-5 py-8 text-sm text-[#94a3b8] text-center">{t('wheel.deliveries.empty')}</p>
            ) : (
                <div className="divide-y divide-[#374151]">
                    {deliveries.map(d => (
                        <div key={d.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                            <div className="flex-1 min-w-[200px]">
                                <p className="text-sm text-[#f8fafc]">
                                    <span className="font-bold">@{d.viewer}</span>
                                    <span className="text-[#64748b]"> · {d.wheelName}</span>
                                </p>
                                <p className="text-xs text-[#94a3b8] mt-0.5">
                                    {describePrize(d.prize, t)}
                                </p>
                                {d.reason && (
                                    <p className="text-xs text-amber-300/80 mt-0.5">{d.reason}</p>
                                )}
                            </div>

                            <span className="text-xs text-[#64748b] tabular-nums">
                                {new Date(d.createdAt).toLocaleString()}
                            </span>

                            {d.status === 'pending' ? (
                                <div className="flex gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => onResolve(d.id, 'done')}
                                        className="px-3 py-1.5 text-xs font-bold bg-green-600/20 text-green-300 border border-green-600/40 rounded-lg hover:bg-green-600/30 transition-colors flex items-center gap-1.5"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        {t('wheel.deliveries.markDone')}
                                    </button>
                                    <button
                                        onClick={() => onResolve(d.id, 'cancelled')}
                                        className="px-3 py-1.5 text-xs font-bold bg-[#262626] text-[#94a3b8] border border-[#374151] rounded-lg hover:text-[#f8fafc] transition-colors flex items-center gap-1.5"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        {t('wheel.deliveries.cancel')}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => onResolve(d.id, 'pending')}
                                    className="px-3 py-1.5 text-xs font-medium text-[#64748b] hover:text-[#f8fafc] transition-colors flex-shrink-0"
                                    title={t('wheel.deliveries.reopenHelp')}
                                >
                                    {t(`wheel.deliveries.status_${d.status}`)} · {t('wheel.deliveries.reopen')}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

/// El premio en una linea legible. La bandeja tiene que decir QUE se debe entregar,
/// no un JSON.
export function describePrize(prize: Prize | null, t: any): string {
    if (!prize) return t('wheel.prizes.nothing');
    const p = prize.params || {};

    switch (prize.type) {
        case 'coins':          return `${p.amount ?? 0} coins`;
        case 'free_spin':      return t('wheel.deliveries.descFreeSpin', { count: p.count ?? 1 });
        case 'gacha_pull':     return t('wheel.deliveries.descGachaPull', { count: p.count ?? 1 });
        case 'timer_time':     return t('wheel.deliveries.descTimerTime', { seconds: p.seconds ?? 0 });
        case 'timeout':        return t('wheel.deliveries.descTimeout', { seconds: p.seconds ?? 0 });
        case 'sound_alert':    return t('wheel.prizes.soundAlert');
        case 'manual_message': return String(p.template || t('wheel.prizes.manualMessage'));
        default:               return t('wheel.prizes.nothing');
    }
}
