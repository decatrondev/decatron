// Uso: quién usó qué comando, cuánto costó y qué se descartó (registro de 30 días, sin el texto de los mensajes).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../../services/api';
import { Card } from '../../../../components/overlay-editor/ui';

interface UsageLog {
    days: number; total: number; truncated: boolean; credits: number;
    outcomes: Record<string, number>;
    byCommand: { command: string; count: number; spoken: number; discarded: number; credits: number }[];
    byUser: { username: string; count: number; credits: number }[];
    recent: { createdAt: string; username: string; platform: string; command: string; ruleType: string; outcome: string; engine: string; voice: string; credits: number | null }[];
}

const DISCARDS = ['blocked_word', 'blocked_user', 'cooldown_global', 'cooldown_user', 'empty', 'no_overlay', 'no_balance', 'queue_full', 'duplicate', 'no_audio'];

export default function UsageCard() {
    const { t, i18n } = useTranslation('speakchat');
    const [days, setDays] = useState(7);
    const [data, setData] = useState<UsageLog | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let alive = true;
        setFailed(false);
        api.get('/speakchat/usage-log', { params: { days } })
            .then(r => { if (alive && r.data?.success) setData(r.data); })
            .catch(() => { if (alive) setFailed(true); });
        return () => { alive = false; };
    }, [days]);

    const name = (c: string) => c || t('v2.usage.noCommand');
    const when = (iso: string) => new Date(iso).toLocaleString(i18n.language, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    const discarded = data ? DISCARDS.reduce((n, k) => n + (data.outcomes[k] ?? 0), 0) : 0;

    return (
        <Card title={t('v2.usage.title')} description={t('v2.usage.description')}>
            <div className="flex items-center gap-3 mb-4">
                {[7, 30].map(d => (
                    <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d}
                        className={days === d ? 'ds-btn ds-btn--primary ds-btn--sm' : 'ds-btn ds-btn--secondary ds-btn--sm'}>{t('v2.usage.lastDays', { count: d })}</button>
                ))}
            </div>

            {failed && <p className="text-sm text-ds-danger">{t('v2.usage.error')}</p>}
            {!failed && data && data.total === 0 && <p className="text-sm 3xl:text-base text-ds-soft">{t('v2.usage.empty')}</p>}

            {data && data.total > 0 && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div><p className="text-xs 3xl:text-sm text-ds-soft">{t('v2.usage.spoken')}</p><p className="text-xl 3xl:text-2xl font-bold text-ds-text">{(data.outcomes.spoken ?? 0).toLocaleString()}</p></div>
                        <div><p className="text-xs 3xl:text-sm text-ds-soft">{t('v2.usage.discarded')}</p><p className="text-xl 3xl:text-2xl font-bold text-ds-text">{discarded.toLocaleString()}</p></div>
                        <div><p className="text-xs 3xl:text-sm text-ds-soft">{t('v2.usage.credits')}</p><p className="text-xl 3xl:text-2xl font-bold text-ds-text">{data.credits.toLocaleString()}</p></div>
                    </div>

                    {discarded > 0 && (
                        <div>
                            <h4 className="text-sm 3xl:text-base font-bold text-ds-text mb-2">{t('v2.usage.whyDiscarded')}</h4>
                            <ul className="text-sm 3xl:text-base text-ds-soft space-y-1">
                                {DISCARDS.filter(k => data.outcomes[k]).map(k => (
                                    <li key={k} className="flex justify-between gap-3"><span>{t(`v2.usage.outcome_${k}`)}</span><span className="text-ds-text font-bold">{data.outcomes[k]}</span></li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div>
                        <h4 className="text-sm 3xl:text-base font-bold text-ds-text mb-2">{t('v2.usage.byCommand')}</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm 3xl:text-base">
                                <thead><tr className="text-left text-ds-soft text-xs 3xl:text-sm">
                                    <th className="py-1 pr-3 font-normal">{t('v2.usage.command')}</th><th className="py-1 pr-3 font-normal">{t('v2.usage.spoken')}</th>
                                    <th className="py-1 pr-3 font-normal">{t('v2.usage.discarded')}</th><th className="py-1 font-normal">{t('v2.usage.credits')}</th>
                                </tr></thead>
                                <tbody>{data.byCommand.map(c => (
                                    <tr key={c.command} className="border-t border-ds-border text-ds-text">
                                        <td className="py-1.5 pr-3 font-bold">{name(c.command)}</td><td className="py-1.5 pr-3">{c.spoken}</td><td className="py-1.5 pr-3">{c.discarded}</td><td className="py-1.5">{c.credits.toLocaleString()}</td>
                                    </tr>))}</tbody>
                            </table>
                        </div>
                    </div>

                    {data.byUser.length > 0 && (
                        <div>
                            <h4 className="text-sm 3xl:text-base font-bold text-ds-text mb-2">{t('v2.usage.byUser')}</h4>
                            <ul className="text-sm 3xl:text-base space-y-1">
                                {data.byUser.map(u => (
                                    <li key={u.username} className="flex justify-between gap-3 text-ds-soft"><span className="text-ds-text">{u.username}</span><span>{t('v2.usage.userLine', { count: u.count, credits: u.credits.toLocaleString() })}</span></li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div>
                        <h4 className="text-sm 3xl:text-base font-bold text-ds-text mb-2">{t('v2.usage.recent')}</h4>
                        <ul className="divide-y divide-ds-border text-sm 3xl:text-base">
                            {data.recent.map((r, i) => (
                                <li key={i} className="py-1.5 flex flex-wrap justify-between gap-x-3 text-ds-soft">
                                    <span><span className="text-ds-text font-bold">{r.username}</span> · {name(r.command || r.ruleType)}</span>
                                    <span className={r.outcome === 'spoken' ? 'text-ds-ok' : ''}>{t(r.outcome === 'spoken' ? 'v2.usage.outcome_spoken' : `v2.usage.outcome_${r.outcome}`)} · {when(r.createdAt)}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    {data.truncated && <p className="text-xs 3xl:text-sm text-ds-soft">{t('v2.usage.truncated')}</p>}
                    <p className="text-xs 3xl:text-sm text-ds-soft">{t('v2.usage.note')}</p>
                </div>
            )}
        </Card>
    );
}
