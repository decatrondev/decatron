import { useState } from 'react';
import { ArrowRight, FlaskConical, Loader2 } from 'lucide-react';
import { type ChannelReward, type SimResult, type Source, type WheelSummary } from '../model';
import { CARD, FIELD } from '../ui';

/**
 * Vista de pruebas: dispara un aporte real contra la rueda.
 *
 * No es un ensayo. El backend corre la MISMA función que el handler de EventSub, así
 * que esto acredita de verdad, gasta de verdad y gira de verdad en el overlay. Es lo
 * unico que sirve para responder "¿funciona si me donan bits?" sin esperar a que
 * alguien done.
 */
export function TestTab({ wheel, sources, rewards, onSimulate, t }: {
    wheel: WheelSummary;
    sources: Source[];
    rewards: ChannelReward[];
    onSimulate: (source: string, amount: number, viewer: string, rewardId?: string | null) => Promise<SimResult | null>;
    t: any;
}) {
    const [source, setSource] = useState('bits');
    const [amount, setAmount] = useState(100);
    const [viewer, setViewer] = useState('');
    const [rewardId, setRewardId] = useState('');
    const [running, setRunning] = useState(false);
    const [log, setLog] = useState<Array<SimResult & { source: string; amount: number; at: string }>>([]);

    const configuradas = sources.filter(s2 => s2.isEnabled);
    const fuenteActiva = source === 'channel_points'
        ? configuradas.some(s2 => s2.source === 'channel_points' && s2.channelPointsRewardId === rewardId)
        : configuradas.some(s2 => s2.source === source);

    const run = async () => {
        setRunning(true);
        const r = await onSimulate(source, source === 'channel_points' ? 1 : amount, viewer, rewardId);
        if (r) setLog(prev => [{ ...r, source, amount, at: new Date().toLocaleTimeString() }, ...prev].slice(0, 8));
        setRunning(false);
    };

    return (
        <div className="space-y-4">
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.test.title')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.test.help')}</p>
                </div>

                <div className="px-5 py-5 space-y-4">
                    <div className="flex flex-wrap items-end gap-3">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-[#94a3b8]">{t('wheel.test.source')}</span>
                            <select value={source} onChange={e => setSource(e.target.value)} className={`${FIELD} w-48`}>
                                <option value="bits">{t('wheel.sources.bits')}</option>
                                <option value="gift_sub">{t('wheel.sources.gift_sub')}</option>
                                <option value="donation">{t('wheel.sources.donation')}</option>
                                <option value="channel_points">{t('wheel.sources.channel_points')}</option>
                            </select>
                        </label>

                        {source === 'channel_points' ? (
                            <label className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
                                <span className="text-xs text-[#94a3b8]">{t('wheel.test.reward')}</span>
                                <select value={rewardId} onChange={e => setRewardId(e.target.value)} className={FIELD}>
                                    <option value="">{t('wheel.rewards.choose')}</option>
                                    {rewards.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                                </select>
                            </label>
                        ) : (
                            <label className="flex flex-col gap-1.5">
                                <span className="text-xs text-[#94a3b8]">{t(`wheel.test.amount_${source}`)}</span>
                                <input
                                    type="number" min={1} value={amount}
                                    onChange={e => setAmount(Math.max(1, Number(e.target.value)))}
                                    className={`${FIELD} w-32`}
                                />
                            </label>
                        )}

                        <label className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
                            <span className="text-xs text-[#94a3b8]">{t('wheel.test.viewer')}</span>
                            <input
                                type="text" value={viewer}
                                onChange={e => setViewer(e.target.value)}
                                placeholder={t('wheel.test.viewerPlaceholder')}
                                className={FIELD}
                            />
                        </label>

                        <button
                            onClick={run}
                            disabled={running || (source === 'channel_points' && !rewardId)}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg font-bold flex items-center gap-2 transition-colors"
                        >
                            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                            {t('wheel.test.run')}
                        </button>
                    </div>

                    {!fuenteActiva && (
                        <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
                            {t('wheel.test.sourceOff')}
                        </p>
                    )}

                    <p className="text-xs text-[#94a3b8]">{t('wheel.test.warning')}</p>
                </div>
            </section>

            {log.length > 0 && (
                <section className={CARD}>
                    <h2 className="px-5 py-4 border-b border-[#374151] font-bold text-[#f8fafc]">{t('wheel.test.results')}</h2>
                    {log.map((r, i) => (
                        <div key={i} className="px-5 py-4 border-b border-[#374151] last:border-0">
                            <div className="flex items-center justify-between gap-3 mb-2">
                                <span className="text-sm font-medium text-[#f8fafc]">
                                    {t(`wheel.sources.${r.source}`)} · {r.viewer}
                                </span>
                                <span className="text-xs text-[#64748b] tabular-nums">{r.at}</span>
                            </div>

                            {!r.credited ? (
                                <p className="text-sm text-amber-300">{t('wheel.test.notCredited')}</p>
                            ) : (
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                                    <span className="text-[#94a3b8]">
                                        {t('wheel.test.credited')}{' '}
                                        <strong className="text-[#E8B455] tabular-nums">+{r.creditsAdded}</strong>
                                    </span>
                                    <span className="text-[#94a3b8] tabular-nums">
                                        {r.balanceBefore} <ArrowRight className="w-3 h-3 inline text-[#64748b]" /> {r.balanceAfter}
                                    </span>
                                    <span className="text-[#94a3b8]">
                                        {t('wheel.test.spinsOwed', { count: r.spinsOwed })}
                                    </span>
                                    {r.spun
                                        ? <span className="text-green-400 font-medium">{t('wheel.test.spun', { label: r.spinLabel })}</span>
                                        : <span className="text-[#64748b]">{t('wheel.test.notSpun')}</span>}
                                </div>
                            )}
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
}
