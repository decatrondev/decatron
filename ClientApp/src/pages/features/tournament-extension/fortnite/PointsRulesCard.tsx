import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Check, Loader2, AlertTriangle, Calculator } from 'lucide-react';
import api from '../../../../services/api';
import type { FortniteConfig, PointsPreset } from './types';
import { TIEBREAKER_LABELS, PROOF_MODE_LABELS, pointsFor, inputClass, labelClass, cardClass, primaryButton, secondaryButton } from './types';

// Reglas de puntos de una edicion de Fortnite: tabla por puesto, puntos por
// eliminacion, desempates, match point, tamaño del lobby y sorteo de solos. Se
// guardan todas juntas con un solo boton.

const ALL_TIEBREAKERS = Object.keys(TIEBREAKER_LABELS);

export default function PointsRulesCard({
    editionId,
    teamSize,
    initial,
    presets,
    onSaved,
}: {
    editionId: number;
    teamSize: number;
    initial: FortniteConfig;
    presets: PointsPreset[];
    onSaved: () => void;
}) {
    const [config, setConfig] = useState<FortniteConfig>(initial);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [previewPlacement, setPreviewPlacement] = useState(1);
    const [previewElims, setPreviewElims] = useState(5);

    useEffect(() => setConfig(initial), [initial]);

    const set = (patch: Partial<FortniteConfig>) => {
        setConfig((c) => ({ ...c, ...patch }));
        setMessage(null);
    };

    const updateRange = (index: number, field: 'from' | 'to' | 'points', value: number) => {
        const next = config.placementPoints.map((r, i) => (i === index ? { ...r, [field]: value } : r));
        set({ placementPoints: next });
    };

    const addRange = () => {
        const last = config.placementPoints[config.placementPoints.length - 1];
        const from = last ? last.to + 1 : 1;
        set({ placementPoints: [...config.placementPoints, { from, to: from, points: 0 }] });
    };

    const moveTiebreaker = (index: number, delta: number) => {
        const list = [...config.tiebreakers];
        const target = index + delta;
        if (target < 0 || target >= list.length) return;
        [list[index], list[target]] = [list[target], list[index]];
        set({ tiebreakers: list });
    };

    const toggleTiebreaker = (id: string) => {
        set({
            tiebreakers: config.tiebreakers.includes(id) ? config.tiebreakers.filter((t) => t !== id) : [...config.tiebreakers, id],
        });
    };

    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            await api.put(`/admin/tournament/editions/${editionId}/fortnite/config`, config);
            setMessage({ ok: true, text: 'Reglas guardadas.' });
            onSaved();
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'No se pudieron guardar las reglas' });
        } finally {
            setSaving(false);
        }
    };

    const teamsPerLobby = Math.max(1, Math.floor(config.maxPlayersPerLobby / Math.max(1, teamSize)));

    return (
        <div className="space-y-4 4xl:space-y-6">
            {/* Tabla de puntos */}
            <section className={cardClass}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">Puntos por partida</h3>
                        <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                            Puntos según el puesto del equipo más puntos por cada eliminación. Empieza con una plantilla y ajústala.
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {presets.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                title={p.description}
                                onClick={() => set({ placementPoints: p.placementPoints, pointsPerElimination: p.pointsPerElimination })}
                                className={secondaryButton}
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] 4xl:grid-cols-[minmax(0,1fr)_360px] gap-4 4xl:gap-6">
                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_1fr_1fr_36px] gap-2 text-[11px] 4xl:text-xs font-bold uppercase text-[#64748b] dark:text-[#94a3b8] font-mono">
                            <span>Desde el puesto</span>
                            <span>Hasta el puesto</span>
                            <span>Puntos</span>
                            <span />
                        </div>
                        {config.placementPoints.map((r, i) => (
                            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_36px] gap-2 items-center">
                                <input type="number" min={1} max={100} value={r.from} onChange={(e) => updateRange(i, 'from', Number(e.target.value))} className={inputClass + ' mt-0'} />
                                <input type="number" min={1} max={100} value={r.to} onChange={(e) => updateRange(i, 'to', Number(e.target.value))} className={inputClass + ' mt-0'} />
                                <input type="number" min={0} max={1000} value={r.points} onChange={(e) => updateRange(i, 'points', Number(e.target.value))} className={inputClass + ' mt-0'} />
                                <button
                                    type="button"
                                    onClick={() => set({ placementPoints: config.placementPoints.filter((_, j) => j !== i) })}
                                    className="p-2 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                    title="Quitar tramo"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={addRange} className="text-xs 4xl:text-sm text-[#2563eb] font-bold flex items-center gap-1 hover:underline">
                            <Plus className="w-3.5 h-3.5" /> Agregar tramo
                        </button>
                        <p className="text-[11px] 4xl:text-xs text-[#64748b] dark:text-[#94a3b8]">Los puestos que no estén en ningún tramo suman 0 por puesto.</p>
                        <div className="max-w-xs pt-2">
                            <label className={labelClass}>Puntos por eliminación</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={config.pointsPerElimination}
                                onChange={(e) => set({ pointsPerElimination: Number(e.target.value) })}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    {/* Calculadora para ver el efecto de la tabla */}
                    <div className="p-3 4xl:p-5 rounded-lg bg-[#f8fafc] dark:bg-[#262626] space-y-2 self-start">
                        <p className="text-xs 4xl:text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-1.5">
                            <Calculator className="w-4 h-4 text-[#2563eb]" /> Probar
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className={labelClass}>Puesto</label>
                                <input type="number" min={1} max={100} value={previewPlacement} onChange={(e) => setPreviewPlacement(Number(e.target.value))} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Eliminaciones</label>
                                <input type="number" min={0} value={previewElims} onChange={(e) => setPreviewElims(Number(e.target.value))} className={inputClass} />
                            </div>
                        </div>
                        <p className="text-sm 4xl:text-base text-[#1e293b] dark:text-[#f8fafc]">
                            = <span className="font-black text-2xl 4xl:text-3xl text-[#2563eb]">{pointsFor(config, previewPlacement, previewElims)}</span> puntos
                        </p>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 4xl:gap-6">
                {/* Desempates */}
                <section className={cardClass}>
                    <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">Desempates</h3>
                    <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">Si dos equipos empatan en puntos, se comparan en este orden.</p>
                    <div className="space-y-1.5">
                        {config.tiebreakers.map((t, i) => (
                            <div key={t} className="flex items-center gap-2 p-2 rounded-lg bg-[#f8fafc] dark:bg-[#262626]">
                                <span className="font-mono text-xs text-[#64748b] dark:text-[#94a3b8] w-5">{i + 1}.</span>
                                <span className="flex-1 text-sm 4xl:text-base text-[#1e293b] dark:text-[#f8fafc]">{TIEBREAKER_LABELS[t] || t}</span>
                                <button type="button" onClick={() => moveTiebreaker(i, -1)} disabled={i === 0} className="p-1 rounded text-[#64748b] hover:text-[#2563eb] disabled:opacity-30" title="Subir">
                                    <ArrowUp className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => moveTiebreaker(i, 1)}
                                    disabled={i === config.tiebreakers.length - 1}
                                    className="p-1 rounded text-[#64748b] hover:text-[#2563eb] disabled:opacity-30"
                                    title="Bajar"
                                >
                                    <ArrowDown className="w-4 h-4" />
                                </button>
                                <button type="button" onClick={() => toggleTiebreaker(t)} className="p-1 rounded text-[#64748b] hover:text-red-600" title="Quitar">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {ALL_TIEBREAKERS.filter((t) => !config.tiebreakers.includes(t)).map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => toggleTiebreaker(t)}
                                className="w-full text-left text-xs 4xl:text-sm text-[#2563eb] font-bold flex items-center gap-1 hover:underline px-2"
                            >
                                <Plus className="w-3.5 h-3.5" /> {TIEBREAKER_LABELS[t]}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Lobby, solos y match point */}
                <section className={cardClass}>
                    <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">Lobby y equipos</h3>
                    <div>
                        <label className={labelClass}>Jugadores por lobby</label>
                        <input
                            type="number"
                            min={2}
                            max={100}
                            value={config.maxPlayersPerLobby}
                            onChange={(e) => set({ maxPlayersPerLobby: Number(e.target.value) })}
                            className={inputClass}
                        />
                        <p className="text-[11px] 4xl:text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">
                            Entran {teamsPerLobby} {teamSize === 1 ? 'jugadores' : 'equipos'} por lobby. Si hay más, se dividen en grupos.
                        </p>
                    </div>
                    {teamSize > 1 && (
                        <label className="flex items-start gap-2 text-sm 4xl:text-base text-[#1e293b] dark:text-[#f8fafc] cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.fillSolosRandomly}
                                onChange={(e) => set({ fillSolosRandomly: e.target.checked })}
                                className="mt-1"
                            />
                            <span>
                                Sortear a los que se inscriben solos
                                <span className="block text-[11px] 4xl:text-xs text-[#64748b] dark:text-[#94a3b8]">
                                    Completan los equipos armados por código y forman equipos nuevos. Si lo apagas, quien no tenga equipo no juega.
                                </span>
                            </span>
                        </label>
                    )}
                    <label className="flex items-start gap-2 text-sm 4xl:text-base text-[#1e293b] dark:text-[#f8fafc] cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.matchPointThreshold != null}
                            onChange={(e) => set({ matchPointThreshold: e.target.checked ? 100 : null })}
                            className="mt-1"
                        />
                        <span>
                            Match point
                            <span className="block text-[11px] 4xl:text-xs text-[#64748b] dark:text-[#94a3b8]">
                                Al llegar a estos puntos, el equipo gana el torneo si gana una partida.
                            </span>
                        </span>
                    </label>
                    {config.matchPointThreshold != null && (
                        <div className="max-w-xs">
                            <label className={labelClass}>Puntos para quedar en match point</label>
                            <input
                                type="number"
                                min={1}
                                value={config.matchPointThreshold}
                                onChange={(e) => set({ matchPointThreshold: Number(e.target.value) })}
                                className={inputClass}
                            />
                        </div>
                    )}
                </section>
            </div>

            {/* Pruebas y reportes (F4) */}
            <section className={cardClass}>
                <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">Pruebas y reportes</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 4xl:gap-5">
                    {Object.entries(PROOF_MODE_LABELS).map(([id, m]) => (
                        <label
                            key={id}
                            className={`p-3 4xl:p-4 rounded-lg border cursor-pointer ${
                                config.proofMode === id ? 'border-[#2563eb] bg-[#2563eb]/5' : 'border-[#e2e8f0] dark:border-[#374151]'
                            }`}
                        >
                            <span className="flex items-center gap-2 font-bold text-sm 4xl:text-base text-[#1e293b] dark:text-[#f8fafc]">
                                <input type="radio" name="proofMode" checked={config.proofMode === id} onChange={() => set({ proofMode: id })} />
                                {m.label}
                                {id === 'always' && <span className="text-[10px] font-normal text-[#64748b]">(por defecto)</span>}
                            </span>
                            <span className="block text-[11px] 4xl:text-xs text-[#64748b] dark:text-[#94a3b8] mt-1">{m.help}</span>
                        </label>
                    ))}
                </div>
                <p className="text-[11px] 4xl:text-xs text-[#64748b] dark:text-[#94a3b8]">
                    En dúo, trío o escuadra cada jugador reporta sus propias eliminaciones; el puesto es del equipo. Si cargas o corriges un resultado a nombre de
                    un equipo, tienes que dejar el motivo y un justificante, y queda en un historial que ven los participantes.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 4xl:gap-5">
                    <div className="max-w-xs">
                        <label className={labelClass}>Minutos para reportar (desde que termina la partida)</label>
                        <input
                            type="number"
                            min={5}
                            max={1440}
                            value={config.reportWindowMinutes}
                            onChange={(e) => set({ reportWindowMinutes: Number(e.target.value) })}
                            className={inputClass}
                        />
                    </div>
                    <label className="flex items-start gap-2 text-sm 4xl:text-base text-[#1e293b] dark:text-[#f8fafc] cursor-pointer md:col-span-2">
                        <input type="checkbox" checked={config.publicScreenshots} onChange={(e) => set({ publicScreenshots: e.target.checked })} className="mt-1" />
                        <span>
                            Mostrar las capturas en la página pública
                            <span className="block text-[11px] 4xl:text-xs text-[#64748b] dark:text-[#94a3b8]">
                                Cualquiera puede ver, en el detalle de cada equipo, las capturas de sus resultados aprobados. Si está apagado solo las ves tú y
                                cada equipo las suyas.
                            </span>
                        </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm 4xl:text-base text-[#1e293b] dark:text-[#f8fafc] cursor-pointer self-end">
                        <input type="checkbox" checked={config.missingReportZero} onChange={(e) => set({ missingReportZero: e.target.checked })} className="mt-1" />
                        <span>
                            Quien no reporta a tiempo suma 0
                            <span className="block text-[11px] 4xl:text-xs text-[#64748b] dark:text-[#94a3b8]">
                                Si lo apagas, antes de cerrar la partida tienes que cargar o rechazar a mano a los equipos que no reportaron.
                            </span>
                        </span>
                    </label>
                </div>
            </section>

            <div className="flex items-center gap-3 flex-wrap">
                <button type="button" onClick={save} disabled={saving} className={primaryButton}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Guardar reglas
                </button>
                {message && (
                    <p className={`text-sm flex items-center gap-1 ${message.ok ? 'text-[#16a34a]' : 'text-red-600 dark:text-red-400'}`}>
                        {message.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {message.text}
                    </p>
                )}
            </div>
        </div>
    );
}
