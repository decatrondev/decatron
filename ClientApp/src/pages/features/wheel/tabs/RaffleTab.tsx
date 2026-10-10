import { useState } from 'react';
import { Plus, Trash2, Trophy } from 'lucide-react';
import { type RaffleConfig, type RaffleEntry } from '../model';
import { parseViewers } from '../namesIO';
import { ExportMenu, ImportButton, ImportPanel } from '../parts/NamesTools';
import { CARD, FIELD, Row, Toggle } from '../ui';

/// La pestana del modo Sorteo: reglas, ventana de inscripcion, pool y sorteo.
/// Todo en una porque el streamer la opera EN VIVO — abrir, ver entrar gente y
/// sortear son tres cosas seguidas, y repartirlas en pestanas obligaria a navegar
/// mientras el chat espera.
export function RaffleTab({
    config, entries, creditLabel, saving, slug,
    onConfig, onWindow, onDraw, onAdd, onImport, onRemove, onMultiplier, onReset, t,
}: {
    config: RaffleConfig;
    entries: RaffleEntry[];
    creditLabel: string;
    saving: boolean;
    slug: string;
    onConfig: (c: Partial<RaffleConfig>) => void;
    onWindow: (open: boolean) => void;
    onDraw: () => void;
    onAdd: (viewer: string) => void;
    onImport: (names: string[]) => Promise<{ ok: number; already: number; failed: number } | null>;
    onRemove: (viewer: string) => void;
    onMultiplier: (viewer: string, mult: number) => void;
    onReset: () => void;
    t: any;
}) {
    const [nuevo, setNuevo] = useState('');
    const [importando, setImportando] = useState(false);
    const [texto, setTexto] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const [resultado, setResultado] = useState<string | null>(null);
    const nombres = parseViewers(texto);

    const importar = async () => {
        setOcupado(true);
        const r = await onImport(nombres);
        setOcupado(false);
        if (!r) return;
        setResultado(t('wheel.io.viewersResult', { ok: r.ok, already: r.already, failed: r.failed }));
        setTexto('');
        setImportando(false);
    };

    // El pool completo (tambien los que ya ganaron): es lo que el streamer querria guardar.
    const textoExportado = () => [
        'viewer;entradas;peso;gano',
        ...entries.map(e => `${e.viewer};${e.entries};${e.weight};${e.hasWon ? 1 : 0}`),
    ].join('\n');

    const pool = entries.filter(e => !e.hasWon);
    const ganadores = entries.filter(e => e.hasWon);
    const pesoTotal = pool.reduce((acc, e) => acc + Number(e.weight || 0), 0);

    const fuentes = config.weightSources || {};
    const reqs = config.requirements || {};

    const setFuente = (nombre: string, cambios: Record<string, unknown>) =>
        onConfig({ weightSources: { ...fuentes, [nombre]: { ...(fuentes[nombre] || {}), ...cambios } } });

    const setReq = (nombre: string, valor: unknown) =>
        onConfig({ requirements: { ...reqs, [nombre]: valor } });

    return (
        <div className="space-y-4">
            {/* --- barra de operacion en vivo --- */}
            <section className={CARD}>
                <div className="px-5 py-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${config.acceptingEntries ? 'bg-ds-ok' : 'bg-ds-raised'}`} />
                            <h2 className="font-bold text-ds-text">
                                {config.acceptingEntries ? t('wheel.raffle.open') : t('wheel.raffle.closed')}
                            </h2>
                        </div>
                        <p className="text-xs text-ds-soft mt-0.5">
                            {t('wheel.raffle.poolCount', { count: pool.length })}
                            {config.windowClosesAt && config.acceptingEntries && (
                                <> · {t('wheel.raffle.closesAt', { time: new Date(config.windowClosesAt).toLocaleTimeString() })}</>
                            )}
                        </p>
                    </div>

                    {/* always_open no tiene nada que abrir ni cerrar: la ventana la
                        decide la configuracion, no un boton. */}
                    {config.windowMode !== 'always_open' && (
                        <button
                            onClick={() => onWindow(!config.acceptingEntries)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                                config.acceptingEntries
                                    ? 'bg-ds-bg border border-ds-border text-ds-text hover:bg-ds-raised'
                                    : 'bg-ds-accent hover:bg-ds-accent-hover text-ds-on-accent'
                            }`}
                        >
                            {config.acceptingEntries ? t('wheel.raffle.close') : t('wheel.raffle.openIt')}
                        </button>
                    )}

                    <button
                        onClick={onDraw}
                        disabled={saving || pool.length < 2}
                        className="ds-btn ds-btn--primary"
                        title={pool.length < 2 ? t('wheel.raffle.needTwo') : undefined}
                    >
                        <Trophy className="w-4 h-4" />
                        {t('wheel.raffle.draw')}
                    </button>

                    <button
                        onClick={onReset}
                        className="px-3 py-2 text-sm text-ds-soft hover:text-ds-text transition-colors"
                    >
                        {t('wheel.raffle.reset')}
                    </button>
                </div>
            </section>

            {/* --- reglas --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.raffle.rulesTitle')}</h2>
                </div>

                <Row label={t('wheel.raffle.entryCommand')} help={t('wheel.raffle.entryCommandHelp')}>
                    <input
                        type="text"
                        value={config.entryCommand}
                        onChange={e => onConfig({ entryCommand: e.target.value })}
                        className={`${FIELD} w-40`}
                    />
                </Row>

                <Row label={t('wheel.raffle.windowMode')} help={t('wheel.raffle.windowModeHelp')}>
                    <select
                        value={config.windowMode}
                        onChange={e => onConfig({ windowMode: e.target.value as RaffleConfig['windowMode'] })}
                        className={FIELD}
                    >
                        <option value="manual">{t('wheel.raffle.windowManual')}</option>
                        <option value="timed">{t('wheel.raffle.windowTimed')}</option>
                        <option value="always_open">{t('wheel.raffle.windowAlways')}</option>
                    </select>
                </Row>

                {config.windowMode === 'timed' && (
                    <Row label={t('wheel.raffle.windowSeconds')} help={t('wheel.raffle.windowSecondsHelp')}>
                        <input
                            type="number" min={10}
                            value={config.windowSeconds ?? 120}
                            onChange={e => onConfig({ windowSeconds: Number(e.target.value) })}
                            className={`${FIELD} w-28`}
                        />
                    </Row>
                )}

                <Row label={t('wheel.raffle.maxEntries')} help={t('wheel.raffle.maxEntriesHelp')}>
                    <input
                        type="number" min={1} max={100}
                        value={config.maxEntriesPerViewer}
                        onChange={e => onConfig({ maxEntriesPerViewer: Number(e.target.value) })}
                        className={`${FIELD} w-24`}
                    />
                </Row>

                <Row label={t('wheel.raffle.entryCost')} help={t('wheel.raffle.entryCostHelp', { credits: creditLabel })}>
                    <input
                        type="number" min={0}
                        value={config.entryCostCredits}
                        onChange={e => onConfig({ entryCostCredits: Number(e.target.value) })}
                        className={`${FIELD} w-28`}
                    />
                </Row>
            </section>

            {/* --- requisitos --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.raffle.reqTitle')}</h2>
                    <p className="text-xs text-ds-soft mt-0.5">{t('wheel.raffle.reqHelp')}</p>
                </div>

                <Row label={t('wheel.raffle.subsOnly')}>
                    <Toggle on={!!reqs.subsOnly} onChange={v => setReq('subsOnly', v)} />
                </Row>

                <Row label={t('wheel.raffle.followersOnly')}>
                    <Toggle on={!!reqs.followersOnly} onChange={v => setReq('followersOnly', v)} />
                </Row>

                <Row label={t('wheel.raffle.minWatchtime')} help={t('wheel.raffle.minWatchtimeHelp')}>
                    <input
                        type="number" min={0}
                        value={Number(reqs.minWatchtimeMinutes ?? 0)}
                        onChange={e => setReq('minWatchtimeMinutes', Number(e.target.value))}
                        className={`${FIELD} w-24`}
                    />
                </Row>
            </section>

            {/* --- pesos --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.raffle.weightTitle')}</h2>
                    <p className="text-xs text-ds-soft mt-0.5">{t('wheel.raffle.weightHelp')}</p>
                </div>

                <Row label={t('wheel.raffle.wWatchtime')} help={t('wheel.raffle.wWatchtimeHelp')}>
                    <Toggle on={!!fuentes.watchtime?.enabled} onChange={v => setFuente('watchtime', { enabled: v })} />
                    {fuentes.watchtime?.enabled && (
                        <>
                            <input
                                type="number" min={1}
                                value={Number(fuentes.watchtime?.minutesPerPoint ?? 60)}
                                onChange={e => setFuente('watchtime', { minutesPerPoint: Number(e.target.value) })}
                                className={`${FIELD} w-24 ml-3`}
                                aria-label={t('wheel.raffle.wMinutes')}
                            />
                            <span className="text-xs text-ds-soft ml-2">{t('wheel.raffle.wMinutes')}</span>
                            <span className="text-xs text-ds-soft ml-3">{t('wheel.raffle.wMax')}</span>
                            <input
                                type="number" min={1} step={0.5}
                                value={Number(fuentes.watchtime?.max ?? 5)}
                                onChange={e => setFuente('watchtime', { max: Number(e.target.value) })}
                                className={`${FIELD} w-20 ml-2`}
                                aria-label={t('wheel.raffle.wMax')}
                            />
                        </>
                    )}
                </Row>

                <Row label={t('wheel.raffle.wSub')} help={t('wheel.raffle.wSubHelp')}>
                    <Toggle on={!!fuentes.subscriber?.enabled} onChange={v => setFuente('subscriber', { enabled: v })} />
                    {fuentes.subscriber?.enabled && (
                        <>
                            <span className="text-xs text-ds-soft ml-3">x</span>
                            <input
                                type="number" min={1} step={0.5}
                                value={Number(fuentes.subscriber?.multiplier ?? 2)}
                                onChange={e => setFuente('subscriber', { multiplier: Number(e.target.value) })}
                                className={`${FIELD} w-20 ml-2`}
                            />
                        </>
                    )}
                </Row>

                <Row label={t('wheel.raffle.wTier')} help={t('wheel.raffle.wTierHelp')}>
                    <Toggle on={!!fuentes.supporterTier?.enabled} onChange={v => setFuente('supporterTier', { enabled: v })} />
                    {fuentes.supporterTier?.enabled && (
                        <div className="flex items-center gap-2 ml-3 flex-wrap">
                            {(['supporter', 'premium', 'fundador'] as const).map(tier => (
                                <label key={tier} className="flex items-center gap-1.5 text-xs text-ds-soft">
                                    {tier}
                                    <input
                                        type="number" min={1} step={0.5}
                                        value={Number(fuentes.supporterTier?.[tier] ?? 1)}
                                        onChange={e => setFuente('supporterTier', { [tier]: Number(e.target.value) })}
                                        className={`${FIELD} w-16`}
                                    />
                                </label>
                            ))}
                        </div>
                    )}
                </Row>

                <Row label={t('wheel.raffle.wCoins')} help={t('wheel.raffle.wCoinsHelp')}>
                    <Toggle on={!!fuentes.coins?.enabled} onChange={v => setFuente('coins', { enabled: v })} />
                    {fuentes.coins?.enabled && (
                        <>
                            <input
                                type="number" min={1}
                                value={Number(fuentes.coins?.coinsPerPoint ?? 1000)}
                                onChange={e => setFuente('coins', { coinsPerPoint: Number(e.target.value) })}
                                className={`${FIELD} w-28 ml-3`}
                                aria-label={t('wheel.raffle.wCoinsPer')}
                            />
                            <span className="text-xs text-ds-soft ml-2">{t('wheel.raffle.wCoinsPer')}</span>
                            <span className="text-xs text-ds-soft ml-3">{t('wheel.raffle.wMax')}</span>
                            <input
                                type="number" min={1} step={0.5}
                                value={Number(fuentes.coins?.max ?? 5)}
                                onChange={e => setFuente('coins', { max: Number(e.target.value) })}
                                className={`${FIELD} w-20 ml-2`}
                                aria-label={t('wheel.raffle.wMax')}
                            />
                        </>
                    )}
                </Row>
            </section>

            {/* --- como se sortea --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border">
                    <h2 className="font-bold text-ds-text">{t('wheel.raffle.drawTitle')}</h2>
                </div>

                <Row label={t('wheel.raffle.drawMode')} help={t('wheel.raffle.drawModeHelp')}>
                    <select
                        value={config.drawMode}
                        onChange={e => onConfig({ drawMode: e.target.value as RaffleConfig['drawMode'] })}
                        className={FIELD}
                    >
                        <option value="single">{t('wheel.raffle.drawSingle')}</option>
                        <option value="multi">{t('wheel.raffle.drawMulti')}</option>
                        <option value="remove_and_continue">{t('wheel.raffle.drawContinue')}</option>
                    </select>
                </Row>

                {config.drawMode !== 'single' && (
                    <Row label={t('wheel.raffle.winnersCount')} help={t('wheel.raffle.winnersCountHelp')}>
                        <input
                            type="number" min={1} max={50}
                            value={config.winnersCount}
                            onChange={e => onConfig({ winnersCount: Number(e.target.value) })}
                            className={`${FIELD} w-24`}
                        />
                    </Row>
                )}

                {/* remove_and_continue saca al ganador por definicion: el toggle ahi
                    seria una opcion que no hace nada. */}
                {config.drawMode !== 'remove_and_continue' && (
                    <Row label={t('wheel.raffle.removeWinner')} help={t('wheel.raffle.removeWinnerHelp')}>
                        <Toggle on={config.removeWinnerFromPool} onChange={v => onConfig({ removeWinnerFromPool: v })} />
                    </Row>
                )}

                <Row label={t('wheel.raffle.clearOnEnd')} help={t('wheel.raffle.clearOnEndHelp')}>
                    <Toggle on={config.clearOnStreamEnd} onChange={v => onConfig({ clearOnStreamEnd: v })} />
                </Row>
            </section>

            {/* --- el pool --- */}
            <section className={CARD}>
                <div className="px-5 py-4 border-b border-ds-border flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-ds-text">{t('wheel.raffle.poolTitle')}</h2>
                        <p className="text-xs text-ds-soft mt-0.5">{t('wheel.raffle.poolHelp')}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <ImportButton open={importando} onClick={() => { setImportando(v => !v); setResultado(null); }} t={t} />
                        <ExportMenu text={textoExportado} filename={`rueda-${slug}-inscritos.csv`} disabled={entries.length === 0} t={t} />
                        <input
                            type="text"
                            value={nuevo}
                            onChange={e => setNuevo(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { onAdd(nuevo); setNuevo(''); } }}
                            placeholder={t('wheel.raffle.addPlaceholder')}
                            className={`${FIELD} w-44`}
                        />
                        <button
                            onClick={() => { onAdd(nuevo); setNuevo(''); }}
                            className="ds-btn ds-btn--secondary"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {importando && (
                    <ImportPanel
                        help={t('wheel.io.viewersHelp')}
                        placeholder={t('wheel.io.viewersPlaceholder')}
                        text={texto}
                        onText={setTexto}
                        summary={nombres.length === 0 ? t('wheel.io.nothingYet') : t('wheel.io.viewersSummary', { count: nombres.length })}
                        applyLabel={t('wheel.io.viewersApply')}
                        canApply={nombres.length > 0}
                        busy={ocupado}
                        onApply={importar}
                        onClose={() => { setImportando(false); setTexto(''); }}
                        t={t}
                    />
                )}
                {resultado && <p role="status" className="px-5 py-3 text-sm text-ds-ok border-b border-ds-border">{resultado}</p>}

                {pool.length === 0 ? (
                    <p className="px-5 py-8 text-sm text-ds-soft text-center">{t('wheel.raffle.poolEmpty')}</p>
                ) : (
                    <div className="divide-y divide-ds-border">
                        {pool.map(e => {
                            // La probabilidad real, que es lo unico que el espectador
                            // percibe. Sin esto el peso es un numero sin significado.
                            const prob = pesoTotal > 0 ? (Number(e.weight) / pesoTotal) * 100 : 0;
                            return (
                                <div key={e.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                                    <span className="font-medium text-ds-text flex-1 min-w-[120px]">@{e.viewer}</span>

                                    <span className="text-xs text-ds-soft">
                                        {t('wheel.raffle.tickets', { count: e.entries })}
                                    </span>

                                    <span className="text-sm font-bold tabular-nums text-ds-accent-text w-16 text-right">
                                        {prob.toFixed(1)}%
                                    </span>

                                    <label className="flex items-center gap-1.5 text-xs text-ds-soft">
                                        x
                                        <input
                                            type="number" min={0.1} step={0.5}
                                            defaultValue={Number(e.breakdown?.manual ?? 1)}
                                            onBlur={ev => {
                                                const v = Number(ev.target.value);
                                                if (v > 0 && v !== Number(e.breakdown?.manual ?? 1)) onMultiplier(e.viewer, v);
                                            }}
                                            className={`${FIELD} w-16`}
                                            title={t('wheel.raffle.manualMult')}
                                        />
                                    </label>

                                    <button
                                        onClick={() => onRemove(e.viewer)}
                                        className="p-2 text-ds-soft hover:text-ds-danger transition-colors"
                                        aria-label={t('wheel.raffle.removeEntry')}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {ganadores.length > 0 && (
                    <div className="px-5 py-4 border-t border-ds-border">
                        <p className="text-xs font-bold text-ds-soft mb-2">{t('wheel.raffle.winnersTitle')}</p>
                        <div className="flex flex-wrap gap-2">
                            {ganadores.map(g => (
                                <span key={g.id} className="px-2.5 py-1 bg-ds-accent/10 border border-ds-ok/40 text-ds-ok rounded-lg text-xs font-medium">
                                    @{g.viewer}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
