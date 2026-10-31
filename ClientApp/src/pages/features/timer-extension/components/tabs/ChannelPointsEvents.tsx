/**
 * Timer Extension - Puntos de canal
 *
 * El streamer elige qué recompensas de puntos de su canal suman tiempo al timer y cuánto suma cada canje.
 * Las recompensas salen de Twitch por el mismo endpoint que usan la Rueda y Speak Chat.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import api from '../../../../../services/api';
import type { ChannelPointRule } from '../../types';

interface Reward { id: string; title: string; cost: number }

const input = 'px-3 py-2 border border-ds-border rounded-lg bg-ds-surface text-ds-text focus:ring-2 focus:ring-ds-accent focus:outline-none';

/** Minutos y segundos para un tiempo en segundos (lo que guarda el servidor). */
function TimeInput({ value, onChange }: { value: number; onChange: (seconds: number) => void }) {
    const { t } = useTranslation('features');
    const m = Math.floor(value / 60), s = value % 60;
    const clamp = (n: number, max: number) => (Number.isNaN(n) ? 0 : Math.min(max, Math.max(0, Math.floor(n))));
    return (
        <span className="inline-flex items-center gap-2 flex-wrap">
            <input type="number" min={0} max={9999} value={m} onChange={e => onChange(clamp(parseInt(e.target.value, 10), 9999) * 60 + s)} className={`${input} w-24`} aria-label={t('timerChannelPoints.minutes')} />
            <span className="text-sm text-ds-soft">{t('timerChannelPoints.minutes')}</span>
            <input type="number" min={0} max={59} value={s} onChange={e => onChange(m * 60 + clamp(parseInt(e.target.value, 10), 59))} className={`${input} w-24`} aria-label={t('timerChannelPoints.seconds')} />
            <span className="text-sm text-ds-soft">{t('timerChannelPoints.seconds')}</span>
        </span>
    );
}

export const ChannelPointsEvents: React.FC<{ rules: ChannelPointRule[]; onChange: (rules: ChannelPointRule[]) => void }> = ({ rules, onChange }) => {
    const { t } = useTranslation('features');
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const { data } = await api.get('/soundalerts/channel-points-rewards');
                if (!alive) return;
                if (data?.success) setRewards(data.rewards || []); else setError(true);
            } catch { if (alive) setError(true); }
            finally { if (alive) setLoading(false); }
        })();
        return () => { alive = false; };
    }, []);

    const update = (i: number, patch: Partial<ChannelPointRule>) => onChange(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
    const used = new Set(rules.map(r => r.rewardId).filter(Boolean));

    return (
        <div className="bg-ds-surface rounded-lg border border-ds-border p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-sm font-bold text-ds-text">✨ {t('timerChannelPoints.title')}</h3>
                    <p className="text-xs text-ds-soft mt-1">{t('timerChannelPoints.help')}</p>
                </div>
                <button type="button" onClick={() => onChange([...rules, { rewardId: '', title: '', timeAdded: 60, enabled: true }])} className="ds-btn ds-btn--primary">
                    <Plus className="w-4 h-4" /> {t('timerChannelPoints.add')}
                </button>
            </div>

            {error && <p className="text-sm text-ds-warn p-3 rounded-lg bg-ds-warn/10 border border-ds-warn/40">{t('timerChannelPoints.loadFailed')}</p>}

            {rules.length === 0 ? (
                <p className="text-sm text-ds-soft py-6 text-center rounded-lg border-2 border-dashed border-ds-border">{t('timerChannelPoints.empty')}</p>
            ) : (
                <div className="space-y-3">
                    {rules.map((r, i) => (
                        <div key={i} className={`p-4 rounded-lg border border-ds-border bg-ds-bg space-y-3 ${r.enabled ? '' : 'opacity-60'}`}>
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer" title={r.enabled ? t('timerChannelPoints.turnOff') : t('timerChannelPoints.turnOn')}>
                                    <input type="checkbox" checked={r.enabled} onChange={e => update(i, { enabled: e.target.checked })} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-ds-raised rounded-full peer peer-checked:bg-ds-accent after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-ds-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                                </label>
                                <select
                                    value={r.rewardId}
                                    onChange={e => { const rw = rewards.find(x => x.id === e.target.value); update(i, { rewardId: e.target.value, title: rw?.title ?? '' }); }}
                                    className={`${input} flex-1 min-w-[220px]`}
                                    disabled={loading}
                                >
                                    <option value="">{t('timerChannelPoints.choose')}</option>
                                    {rewards.map(rw => (
                                        <option key={rw.id} value={rw.id} disabled={used.has(rw.id) && rw.id !== r.rewardId}>{rw.title} — {rw.cost}</option>
                                    ))}
                                    {/* Una recompensa borrada del canal sigue guardada: se muestra para que se entienda por qué no suma */}
                                    {r.rewardId && !rewards.some(rw => rw.id === r.rewardId) && !loading && (
                                        <option value={r.rewardId}>{r.title || r.rewardId} {t('timerChannelPoints.missing')}</option>
                                    )}
                                </select>
                                <button type="button" onClick={() => onChange(rules.filter((_, k) => k !== i))} className="p-2 rounded-lg hover:bg-ds-danger/10 text-ds-danger" title={t('timerChannelPoints.remove')}>
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-ds-soft uppercase tracking-wider mb-2">{t('timerChannelPoints.timePerRedeem')}</p>
                                <TimeInput value={r.timeAdded} onChange={v => update(i, { timeAdded: v })} />
                                {r.rewardId && r.timeAdded <= 0 && <p className="text-xs text-ds-warn mt-2">{t('timerChannelPoints.zeroWarning')}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="text-xs text-ds-soft space-y-1">
                <p>⏸ {t('timerChannelPoints.noTimerNote')}</p>
                <p>↩ {t('timerChannelPoints.refundNote')}</p>
                <p>⚡ {t('timerChannelPoints.happyHourNote')}</p>
            </div>
        </div>
    );
};

export default ChannelPointsEvents;
