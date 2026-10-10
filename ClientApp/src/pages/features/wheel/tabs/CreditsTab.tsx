import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { type ChannelReward, type Source, type WheelSummary } from '../model';
import { CARD, FIELD, Row, Toggle } from '../ui';

/**
 * De dónde salen los créditos y cuánto vale cada aporte.
 *
 * La tasa se edita como fracción y no como decimal porque así se guarda: "1 sub =
 * 500 fichas" y "100 bits = 1 ficha" son la misma estructura y no hay redondeo que
 * discuta con el saldo del espectador.
 */
export function CreditsTab({ wheel, sources, rewards, rewardsError, onWheel, onSource, onSourceAt, onAddReward, onRemoveAt, t }: {
    wheel: WheelSummary;
    sources: Source[];
    rewards: ChannelReward[];
    rewardsError: boolean;
    onWheel: (c: Partial<WheelSummary>) => void;
    onSource: (name: string, c: Partial<Source>) => void;
    onSourceAt: (index: number, c: Partial<Source>) => void;
    onAddReward: () => void;
    onRemoveAt: (index: number) => void;
    t: any;
}) {
    return (
        <div className="space-y-4">
            <section className={CARD}>
                <h2 className="px-5 py-4 border-b border-ds-border font-bold text-ds-text">{t('wheel.credits.title')}</h2>

                <Row label={t('wheel.credits.label')} help={t('wheel.credits.labelHelp')}>
                    <input
                        type="text"
                        value={wheel.creditLabel ?? ''}
                        onChange={e => onWheel({ creditLabel: e.target.value })}
                        className={`${FIELD} w-40`}
                    />
                </Row>

                <Row label={t('wheel.credits.price')} help={t('wheel.credits.priceHelp')}>
                    <input
                        type="number"
                        min={1}
                        value={wheel.spinPrice ?? 100}
                        onChange={e => onWheel({ spinPrice: Number(e.target.value) })}
                        className={`${FIELD} w-28`}
                    />
                </Row>

                <Row label={t('wheel.credits.accumulable')} help={t('wheel.credits.accumulableHelp')}>
                    <Toggle on={!!wheel.isAccumulable} onChange={v => onWheel({ isAccumulable: v })} />
                </Row>

                {!wheel.isAccumulable && (
                    <Row label={t('wheel.credits.overflow')} help={t('wheel.credits.overflowHelp')}>
                        <select
                            value={wheel.overflowPolicy ?? 'discard'}
                            onChange={e => onWheel({ overflowPolicy: e.target.value })}
                            className={FIELD}
                        >
                            <option value="discard">{t('wheel.credits.overflowDiscard')}</option>
                            <option value="cheapest_spins">{t('wheel.credits.overflowKeep')}</option>
                        </select>
                    </Row>
                )}

                {/* "viewer_choice" no esta en la lista a proposito: la columna y el
                    modelo lo aceptan, pero el flujo de que el espectador elija cuanto
                    gastar no existe todavia y el servicio lo trata como most_spins.
                    Vuelve al selector cuando se construya de verdad. */}
                <Row label={t('wheel.credits.multiFit')} help={t('wheel.credits.multiFitHelp')}>
                    <select
                        value={wheel.multiFitPolicy === 'most_expensive' ? 'most_expensive' : 'most_spins'}
                        onChange={e => onWheel({ multiFitPolicy: e.target.value })}
                        className={FIELD}
                    >
                        <option value="most_spins">{t('wheel.credits.multiMost')}</option>
                        <option value="most_expensive">{t('wheel.credits.multiExpensive')}</option>
                        <option value="viewer_choice">{t('wheel.credits.multiChoice')}</option>
                    </select>
                </Row>

                <Row label={t('wheel.credits.expiry')} help={t('wheel.credits.expiryHelp')}>
                    <select
                        value={wheel.creditExpiry ?? 'never'}
                        onChange={e => onWheel({ creditExpiry: e.target.value })}
                        className={FIELD}
                    >
                        <option value="never">{t('wheel.credits.expiryNever')}</option>
                        <option value="stream_end">{t('wheel.credits.expiryStream')}</option>
                    </select>
                </Row>
            </section>

            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.sources.title')}</h2>
                    <p className="text-xs text-ds-soft mt-0.5">{t('wheel.sources.help')}</p>
                </div>

                {sources.map((src, i) => src.source === 'channel_points' ? null : (
                    <div key={src.source} className={`px-5 py-4 border-b border-ds-border ${src.isEnabled ? '' : 'opacity-60'}`}>
                        <div className="flex flex-wrap items-center gap-3">
                            <Toggle on={src.isEnabled} onChange={v => onSource(src.source, { isEnabled: v })} />
                            <span className="font-medium text-ds-text w-36">{t(`wheel.sources.${src.source}`)}</span>

                            <span className="text-xs text-ds-soft">{t('wheel.sources.forEvery')}</span>
                            <input
                                type="number" min={1}
                                value={src.rateDenominator}
                                onChange={e => onSource(src.source, { rateDenominator: Math.max(1, Number(e.target.value)) })}
                                className={`${FIELD} w-20`}
                                aria-label={t('wheel.sources.perUnits')}
                            />
                            <span className="text-xs text-ds-soft">{t(`wheel.sources.unit_${src.source}`)}</span>
                            <ArrowRight className="w-4 h-4 text-ds-soft" />
                            <input
                                type="number" min={1}
                                value={src.rateNumerator}
                                onChange={e => onSource(src.source, { rateNumerator: Math.max(1, Number(e.target.value)) })}
                                className={`${FIELD} w-24`}
                                aria-label={t('wheel.sources.credits')}
                            />
                            <span className="text-xs text-ds-soft">{wheel.creditLabel}</span>

                            <label className="flex items-center gap-2 text-xs text-ds-soft ml-auto">
                                {t('wheel.sources.cap')}
                                <input
                                    type="number" min={1}
                                    value={src.capPerEvent ?? ''}
                                    placeholder={t('wheel.sources.noCap')}
                                    onChange={e => onSource(src.source, { capPerEvent: e.target.value ? Number(e.target.value) : null })}
                                    className={`${FIELD} w-28`}
                                />
                            </label>
                        </div>

                        {/* Solo los subs de regalo: es la unica fuente por la que
                            Twitch manda el tier. Por el chat no llega — el badge de
                            sub trae los meses, no el tier. */}
                        {src.source === 'gift_sub' && (
                            <div className="px-5 pb-4 flex flex-wrap items-center gap-3">
                                <span className="text-xs text-ds-soft">{t('wheel.sources.tierMultiplier')}</span>
                                <label className="flex items-center gap-1.5 text-xs text-ds-soft">
                                    {t('wheel.sources.tier2')}
                                    <input
                                        type="number" min={1} max={10} step={0.25}
                                        value={src.tier2Multiplier}
                                        onChange={e => onSource(src.source, { tier2Multiplier: Number(e.target.value) || 1 })}
                                        className={`${FIELD} w-20`}
                                    />
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-ds-soft">
                                    {t('wheel.sources.tier3')}
                                    <input
                                        type="number" min={1} max={10} step={0.25}
                                        value={src.tier3Multiplier}
                                        onChange={e => onSource(src.source, { tier3Multiplier: Number(e.target.value) || 1 })}
                                        className={`${FIELD} w-20`}
                                    />
                                </label>
                                <span className="text-xs text-ds-soft">{t('wheel.sources.tierHelp')}</span>
                            </div>
                        )}
                    </div>
                ))}
            </section>

            {/* Los puntos de canal van aparte: no es una tasa, es una lista de
                recompensas, y cada una da lo suyo. Un canje es un evento, no una
                cantidad, asi que "por cada N" no significa nada aca. */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border flex items-center justify-between gap-4">
                    <div>
                        <h2 className="font-bold text-ds-text">{t('wheel.rewards.title')}</h2>
                        <p className="text-xs text-ds-soft mt-0.5">{t('wheel.rewards.help')}</p>
                    </div>
                    <button
                        onClick={onAddReward}
                        className="ds-btn ds-btn--secondary ds-btn--sm flex-shrink-0"
                    >
                        <Plus className="w-4 h-4" />
                        {t('wheel.rewards.add')}
                    </button>
                </div>

                {rewardsError && (
                    <p className="px-5 py-4 text-sm text-ds-warn bg-ds-warn/10">{t('wheel.rewards.loadFailed')}</p>
                )}

                {sources.filter(s2 => s2.source === 'channel_points').length === 0 ? (
                    <p className="px-5 py-6 text-sm text-ds-soft">{t('wheel.rewards.empty')}</p>
                ) : sources.map((src, i) => src.source !== 'channel_points' ? null : (
                    <div key={`cp-${i}`} className={`px-5 py-4 border-b border-ds-border last:border-0 flex flex-wrap items-center gap-3 ${src.isEnabled ? '' : 'opacity-60'}`}>
                        <Toggle on={src.isEnabled} onChange={v => onSourceAt(i, { isEnabled: v })} />

                        <select
                            value={src.channelPointsRewardId ?? ''}
                            onChange={e => {
                                const r = rewards.find(x => x.id === e.target.value);
                                onSourceAt(i, {
                                    channelPointsRewardId: e.target.value || null,
                                    channelPointsRewardTitle: r?.title ?? null,
                                });
                            }}
                            className={`${FIELD} flex-1 min-w-[220px]`}
                        >
                            <option value="">{t('wheel.rewards.choose')}</option>
                            {rewards.map(r => (
                                <option key={r.id} value={r.id}>{r.title} — {r.cost}</option>
                            ))}
                            {/* Una recompensa borrada del canal seguiria guardada acá; se
                                muestra igual para que se vea por que esa fila no dispara. */}
                            {src.channelPointsRewardId && !rewards.some(r => r.id === src.channelPointsRewardId) && (
                                <option value={src.channelPointsRewardId}>
                                    {src.channelPointsRewardTitle || src.channelPointsRewardId} {t('wheel.rewards.missing')}
                                </option>
                            )}
                        </select>

                        <ArrowRight className="w-4 h-4 text-ds-soft" />
                        <input
                            type="number" min={1}
                            value={src.rateNumerator}
                            onChange={e => onSourceAt(i, { rateNumerator: Math.max(1, Number(e.target.value)) })}
                            className={`${FIELD} w-28`}
                            aria-label={t('wheel.sources.credits')}
                        />
                        <span className="text-xs text-ds-soft">{wheel.creditLabel}</span>

                        <button
                            onClick={() => onRemoveAt(i)}
                            className="p-2 hover:bg-ds-danger-solid/10 rounded-lg transition-colors ml-auto"
                            aria-label={t('wheel.rewards.remove')}
                        >
                            <Trash2 className="w-4 h-4 text-ds-danger" />
                        </button>
                    </div>
                ))}
            </section>
        </div>
    );
}
