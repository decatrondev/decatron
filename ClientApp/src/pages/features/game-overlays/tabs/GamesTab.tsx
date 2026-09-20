/**
 * Pestaña Juegos: por cada juego del catalogo, activar, elegir que cuentas se
 * muestran (de las vinculadas), rotacion y alcance de la sesion. Lo visual va
 * en la pestaña Diseño.
 */
import React from 'react';
import { Gamepad2, Palette } from 'lucide-react';
import { Card, SectionTitle, SubLabel, Label, Toggle, SelectInput, NumberInput, Checkbox, TierLock } from '../../now-playing-extension/components/ui/SharedUI';
import { CatalogEntry, LinkedAccount, TierLimits } from '../api';
import { GAME_IDS, GAME_NAMES, GameId, GameVisualConfig, QUEUE_LABELS } from '../types';

interface Props {
    games: Record<GameId, GameVisualConfig>;
    accounts: LinkedAccount[];
    catalog: CatalogEntry[];
    limits: TierLimits;
    onChange: (game: GameId, patch: Partial<GameVisualConfig>) => void;
    onDesign: (game: GameId) => void;
}

export const GamesTab: React.FC<Props> = ({ games, accounts, catalog, limits, onChange, onDesign }) => (
    <div className="space-y-4">
        <Card>
            <SectionTitle>Juegos</SectionTitle>
            <SubLabel>Activa los juegos que streameas. El overlay muestra solo el que estás jugando (por la categoría del stream) y se oculta con el resto.</SubLabel>
        </Card>
        {GAME_IDS.map(game => {
            const cfg = games[game];
            const entry = catalog.find(c => c.game === game);
            const mine = accounts.filter(a => a.game === game && a.isActive);
            const canInterval = limits.allowedRotationModes.includes('interval');
            const canActive = limits.allowedRotationModes.includes('active_first');
            const queues = entry?.capabilities?.supportedQueues ?? [];
            const queueOptions = queues.map(q => ({ value: q, label: QUEUE_LABELS[q] ?? q }));
            const gameQueue = cfg.queue ?? queues[0];
            return (
                <Card key={game} className={cfg.enabled ? '' : 'opacity-80'}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${cfg.accent}22`, color: cfg.accent }}>
                                <Gamepad2 className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-semibold text-[#f8fafc]">{GAME_NAMES[game]}</div>
                                <div className="text-xs text-[#94a3b8]">{entry?.hasApi ? 'Datos automáticos' : 'Rango manual (sin API por ahora)'} · {mine.length} cuenta(s) vinculada(s)</div>
                            </div>
                        </div>
                        <Toggle checked={cfg.enabled} onChange={v => onChange(game, { enabled: v })} label="" size="sm" />
                    </div>

                    {cfg.enabled && (
                        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div>
                                <Label>Cuentas a mostrar <span className="text-[#6b7280] font-normal">(máx. {limits.maxAccountsPerGame})</span></Label>
                                {mine.length === 0 ? (
                                    <p className="text-xs text-amber-400 mt-1">No tienes cuentas de {GAME_NAMES[game]}. Vincula una en la pestaña Cuentas.</p>
                                ) : (
                                    <div className="space-y-1.5 mt-1">
                                        {mine.map(a => {
                                            const checked = cfg.accounts.includes(a.id);
                                            const disabled = !checked && cfg.accounts.length >= limits.maxAccountsPerGame;
                                            const override = cfg.accountQueues?.[String(a.id)] ?? '';
                                            return (
                                                <div key={a.id} className={`flex items-center justify-between gap-2 ${disabled ? 'opacity-50' : ''}`}>
                                                    <Checkbox
                                                        checked={checked}
                                                        onChange={v => onChange(game, { accounts: v ? [...cfg.accounts, a.id] : cfg.accounts.filter(id => id !== a.id) })}
                                                        label={`${a.displayName} · ${a.fullName}${a.verified ? '' : ' (sin verificar)'}`}
                                                    />
                                                    {checked && queues.length > 1 && (
                                                        <select
                                                            value={override}
                                                            onChange={e => {
                                                                const next = { ...(cfg.accountQueues ?? {}) };
                                                                if (e.target.value) next[String(a.id)] = e.target.value; else delete next[String(a.id)];
                                                                onChange(game, { accountQueues: next });
                                                            }}
                                                            className="bg-[#111214] border border-[#374151] rounded-md px-2 py-1 text-xs text-[#e6edf3]"
                                                            title="Cola de esta cuenta"
                                                        >
                                                            <option value="">Igual que el juego ({QUEUE_LABELS[gameQueue] ?? gameQueue})</option>
                                                            {queueOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                                        </select>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                {cfg.accounts.length > 1 && (
                                    <p className="text-[11px] text-[#6b7280] mt-2">El orden de rotación es el orden en que las marcaste.</p>
                                )}
                            </div>

                            <div className="space-y-4">
                                {queues.length > 1 && (
                                    <div>
                                        <Label>Cola a mostrar</Label>
                                        <SelectInput value={gameQueue} onChange={v => onChange(game, { queue: v })} options={queueOptions} />
                                        <p className="text-[11px] text-[#6b7280] mt-1">Aplica a todas las cuentas; cada cuenta puede cambiarla a la derecha.</p>
                                    </div>
                                )}
                                <div>
                                    <Label>Rotación entre cuentas</Label>
                                    <div className="space-y-2 mt-1">
                                        <SelectInput
                                            value={cfg.rotation.mode}
                                            onChange={v => onChange(game, { rotation: { ...cfg.rotation, mode: v as any } })}
                                            options={[
                                                { value: 'none', label: 'Sin rotación (primera cuenta)' },
                                                { value: 'interval', label: `Cada X segundos${canInterval ? '' : ' — Supporter'}`, disabled: !canInterval },
                                                { value: 'active_first', label: `La que está en partida${canActive ? '' : ' — Premium'}`, disabled: !canActive },
                                            ]}
                                        />
                                        {cfg.rotation.mode !== 'none' && (
                                            <TierLock allowed={canInterval} requiredTier="supporter">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-[#94a3b8]">Cada</span>
                                                    <div className="w-24"><NumberInput value={cfg.rotation.seconds} onChange={v => onChange(game, { rotation: { ...cfg.rotation, seconds: v } })} min={5} max={600} /></div>
                                                    <span className="text-xs text-[#94a3b8]">segundos</span>
                                                </div>
                                            </TierLock>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <Label>Sesión (W-L y delta)</Label>
                                    <SelectInput
                                        value={cfg.sessionScope}
                                        onChange={v => onChange(game, { sessionScope: v as any })}
                                        options={[{ value: 'visible_account', label: 'De la cuenta que se muestra' }, { value: 'all_accounts', label: 'Sumada de todas las cuentas' }]}
                                    />
                                </div>
                                <button onClick={() => onDesign(game)} className="px-3 py-2 bg-[#262626] hover:bg-[#333] text-white rounded-lg text-sm flex items-center gap-2 border border-[#374151]">
                                    <Palette className="w-4 h-4" /> Editar diseño
                                </button>
                            </div>
                        </div>
                    )}
                </Card>
            );
        })}
    </div>
);
