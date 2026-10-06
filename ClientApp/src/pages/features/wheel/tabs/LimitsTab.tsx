import { type WheelSummary } from '../model';
import { CARD, FIELD, Row, Toggle } from '../ui';

/** Cómo se dispara el giro y qué frenos tiene. */
export function LimitsTab({ wheel, onWheel, t }: {
    wheel: WheelSummary;
    onWheel: (c: Partial<WheelSummary>) => void;
    t: any;
}) {
    return (
        <div className="space-y-4">
            <section className={CARD}>
                <h2 className="px-5 py-4 border-b border-[#374151] font-bold text-[#f8fafc]">{t('wheel.triggers.title')}</h2>

                <Row label={t('wheel.triggers.commands')} help={t('wheel.triggers.commandsHelp')}>
                    <Toggle on={wheel.commandEnabled !== false} onChange={v => onWheel({ commandEnabled: v })} />
                </Row>

                {wheel.commandEnabled !== false && (
                    <>
                        <Row label={t('wheel.triggers.spinCommand')}>
                            <input
                                type="text"
                                value={wheel.spinCommand ?? '!dgirar'}
                                onChange={e => onWheel({ spinCommand: e.target.value })}
                                className={`${FIELD} w-40 font-mono`}
                            />
                        </Row>
                        <Row label={t('wheel.triggers.balanceCommand')}>
                            <input
                                type="text"
                                value={wheel.balanceCommand ?? '!dcreditos'}
                                onChange={e => onWheel({ balanceCommand: e.target.value })}
                                className={`${FIELD} w-40 font-mono`}
                            />
                        </Row>

                        {/* El de compra solo hace algo si la fuente deca_coins esta
                            encendida; el interruptor de la fuente es el que manda y
                            por eso este comando no tiene el suyo. */}
                        <Row label={t('wheel.triggers.buyCommand')} help={t('wheel.triggers.buyCommandHelp')}>
                            <input
                                value={wheel.buyCommand ?? '!dcomprar'}
                                onChange={e => onWheel({ buyCommand: e.target.value })}
                                className={`${FIELD} w-40 font-mono`}
                            />
                        </Row>
                    </>
                )}

                <Row label={t('wheel.triggers.autoSpin')} help={t('wheel.triggers.autoSpinHelp')}>
                    <Toggle on={!!wheel.autoSpin} onChange={v => onWheel({ autoSpin: v })} />
                </Row>
            </section>

            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.limits.title')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.limits.help')}</p>
                </div>

                <Row label={t('wheel.limits.cooldown')} help={t('wheel.limits.cooldownHelp')}>
                    <input
                        type="number" min={0}
                        value={wheel.spinCooldownSeconds ?? 0}
                        onChange={e => onWheel({ spinCooldownSeconds: Number(e.target.value) })}
                        className={`${FIELD} w-24`}
                    />
                    <span className="text-xs text-[#94a3b8]">{t('wheel.limits.seconds')}</span>
                </Row>

                <Row label={t('wheel.limits.maxPerStream')} help={t('wheel.limits.maxPerStreamHelp')}>
                    <input
                        type="number" min={1}
                        value={wheel.maxSpinsPerStream ?? ''}
                        placeholder={t('wheel.limits.noLimit')}
                        onChange={e => onWheel({ maxSpinsPerStream: e.target.value ? Number(e.target.value) : null })}
                        className={`${FIELD} w-28`}
                    />
                </Row>

                <Row label={t('wheel.limits.maxCoins')} help={t('wheel.limits.maxCoinsHelp')}>
                    <input
                        type="number" min={1}
                        value={wheel.maxCoinsPerHour ?? ''}
                        placeholder={t('wheel.limits.noLimit')}
                        onChange={e => onWheel({ maxCoinsPerHour: e.target.value ? Number(e.target.value) : null })}
                        className={`${FIELD} w-28`}
                    />
                </Row>
            </section>

            {/* --- reglas del sorteo (Fase 7) --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-[#374151]">
                    <h2 className="font-bold text-[#f8fafc]">{t('wheel.rules.title')}</h2>
                    <p className="text-xs text-[#94a3b8] mt-0.5">{t('wheel.rules.help')}</p>
                </div>

                <Row label={t('wheel.rules.noRepeat')} help={t('wheel.rules.noRepeatHelp')}>
                    <select
                        value={wheel.noRepeatScope ?? 'off'}
                        onChange={e => onWheel({ noRepeatScope: e.target.value })}
                        className={FIELD}
                    >
                        <option value="off">{t('wheel.rules.noRepeatOff')}</option>
                        <option value="per_viewer">{t('wheel.rules.noRepeatViewer')}</option>
                        <option value="global">{t('wheel.rules.noRepeatGlobal')}</option>
                    </select>
                </Row>

                <Row label={t('wheel.rules.pity')} help={t('wheel.rules.pityHelp')}>
                    <Toggle on={!!wheel.pityEnabled} onChange={v => onWheel({ pityEnabled: v })} />
                    {wheel.pityEnabled && (
                        <>
                            <span className="text-xs text-[#94a3b8] mx-3">{t('wheel.rules.pityAfter')}</span>
                            <input
                                type="number" min={1} max={100}
                                value={wheel.pityThreshold ?? ''}
                                placeholder="10"
                                onChange={e => onWheel({ pityThreshold: e.target.value ? Number(e.target.value) : null })}
                                className={`${FIELD} w-20`}
                            />
                        </>
                    )}
                </Row>

                <Row label={t('wheel.rules.multi')} help={t('wheel.rules.multiHelp')}>
                    <Toggle on={!!wheel.allowMultiSpin} onChange={v => onWheel({ allowMultiSpin: v })} />
                    {wheel.allowMultiSpin && (
                        <>
                            <span className="text-xs text-[#94a3b8] mx-3">{t('wheel.rules.multiMax')}</span>
                            <input
                                type="number" min={1} max={100}
                                value={wheel.maxMultiSpin ?? 10}
                                onChange={e => onWheel({ maxMultiSpin: Number(e.target.value) || 1 })}
                                className={`${FIELD} w-20`}
                            />
                        </>
                    )}
                </Row>

                {wheel.allowMultiSpin && (
                    <p className="px-5 pb-4 text-xs text-[#64748b]">
                        {t('wheel.rules.multiNote', { command: wheel.spinCommand || '!dgirar' })}
                    </p>
                )}
            </section>
        </div>
    );
}
