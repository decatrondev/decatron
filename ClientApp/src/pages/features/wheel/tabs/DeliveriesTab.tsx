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
        <section className="bg-ds-surface rounded-lg border border-ds-border overflow-hidden">
            <div className="px-5 py-4 border-b border-ds-border flex items-center justify-between gap-4">
                <div>
                    <h2 className="font-bold text-ds-text">{t('wheel.deliveries.title')}</h2>
                    <p className="text-xs text-ds-soft mt-0.5">{t('wheel.deliveries.help')}</p>
                </div>
                <div className="flex gap-1 bg-ds-bg rounded-lg p-1 flex-shrink-0">
                    {(['pending', 'all'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => onFilter(f)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                                filter === f ? 'bg-ds-accent text-ds-on-accent' : 'text-ds-soft hover:text-ds-text'
                            }`}
                        >
                            {t(`wheel.deliveries.filter_${f}`)}
                        </button>
                    ))}
                </div>
            </div>

            {deliveries.length === 0 ? (
                <p className="px-5 py-8 text-sm text-ds-soft text-center">{t('wheel.deliveries.empty')}</p>
            ) : (
                <div className="divide-y divide-ds-border">
                    {deliveries.map(d => (
                        <div key={d.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                            <div className="flex-1 min-w-[200px]">
                                <p className="text-sm text-ds-text">
                                    <span className="font-bold">@{d.viewer}</span>
                                    <span className="text-ds-soft"> · {d.wheelName}</span>
                                </p>
                                <p className="text-xs text-ds-soft mt-0.5">
                                    {describePrize(d.prize, t)}
                                </p>
                                {d.reason && (
                                    <p className="text-xs text-ds-warn/80 mt-0.5">{d.reason}</p>
                                )}
                            </div>

                            <span className="text-xs text-ds-soft tabular-nums">
                                {new Date(d.createdAt).toLocaleString()}
                            </span>

                            {d.status === 'pending' ? (
                                <div className="flex gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => onResolve(d.id, 'done')}
                                        className="px-3 py-1.5 text-xs font-bold bg-ds-accent/20 text-ds-ok border border-ds-ok/40 rounded-lg hover:bg-ds-accent/30 transition-colors flex items-center gap-1.5"
                                    >
                                        <Check className="w-3.5 h-3.5" />
                                        {t('wheel.deliveries.markDone')}
                                    </button>
                                    <button
                                        onClick={() => onResolve(d.id, 'cancelled')}
                                        className="ds-btn ds-btn--secondary ds-btn--sm"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        {t('wheel.deliveries.cancel')}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => onResolve(d.id, 'pending')}
                                    className="px-3 py-1.5 text-xs font-medium text-ds-soft hover:text-ds-text transition-colors flex-shrink-0"
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
