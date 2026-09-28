import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import api from '../../../services/api';

// Editor del catalogo del motor de castigos: los castigos que se pueden lanzar y las
// condiciones que dan fichas. Antes solo se podian sembrar los valores de ejemplo;
// en Fortnite el catalogo lo arma cada streamer (.dev/torneos/15-fortnite.md F6), y
// sirve igual para LoL. Borrar algo ya usado lo desactiva (queda en el historial).

export interface CatalogPunishment {
    id: number;
    name: string;
    allowsReverse: boolean;
    isActive: boolean;
}

export interface CatalogTrigger {
    id: number;
    name: string;
    conditionType: string;
    statField: string | null;
    thresholdValue: number;
    streakLength: number | null;
    shellsGranted: number;
    isActive: boolean;
}

interface ConditionDef {
    label: string;
    valueLabel?: string;
    stat?: boolean;
    streak?: boolean;
}

const LOL_CONDITIONS: Record<string, ConditionDef> = {
    stat_threshold: { label: 'Estadística en una partida', valueLabel: 'Mínimo', stat: true },
    streak_wins: { label: 'Racha de victorias', valueLabel: 'Victorias seguidas' },
    perfect_kda: { label: 'KDA perfecto (sin morir)', valueLabel: 'Kills + asistencias mínimas' },
    match_duration_min: { label: 'Ganar una partida larga', valueLabel: 'Minutos mínimos' },
    champion_variety: { label: 'Victorias con campeones distintos', valueLabel: 'Cada cuántos campeones' },
    win_with_active_punishment: { label: 'Ganar con un castigo activo' },
    penta_kills: { label: 'Pentakills en una partida', valueLabel: 'Pentakills mínimos' },
};

const FORTNITE_CONDITIONS: Record<string, ConditionDef> = {
    fn_win: { label: 'Ganar una partida' },
    fn_eliminations: { label: 'Eliminaciones del equipo en una partida', valueLabel: 'Mínimo de eliminaciones' },
    fn_top_streak: { label: 'Racha de top N', valueLabel: 'Top (puesto máximo)', streak: true },
    fn_comeback: { label: 'Remontada en una sesión', valueLabel: 'Puestos que sube en la tabla' },
};

const STAT_LABELS: Record<string, string> = { kills: 'Kills', assists: 'Asistencias', deaths: 'Muertes' };

const input =
    'w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm 4xl:text-base';
const label = 'text-xs 4xl:text-sm font-bold text-[#64748b] dark:text-[#94a3b8]';
const btnPrimary =
    'flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50';
const btnGhost = 'p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb]';

export function describeTrigger(t: CatalogTrigger, isFortnite: boolean): string {
    const def = (isFortnite ? FORTNITE_CONDITIONS : LOL_CONDITIONS)[t.conditionType];
    if (!def) return t.conditionType;
    if (t.conditionType === 'fn_top_streak') return `Top ${t.thresholdValue} en ${t.streakLength ?? 3} partidas seguidas`;
    if (def.stat) return `${STAT_LABELS[t.statField || ''] || t.statField} ≥ ${t.thresholdValue} en una partida`;
    return def.valueLabel ? `${def.label}: ${t.thresholdValue}` : def.label;
}

export default function BlueShellCatalogEditor({
    editionId,
    isFortnite,
    itemName,
    punishments,
    triggers,
    onChanged,
}: {
    editionId: number;
    isFortnite: boolean;
    itemName: string;
    punishments: CatalogPunishment[];
    triggers: CatalogTrigger[];
    onChanged: () => void;
}) {
    const [error, setError] = useState('');
    const base = `/admin/tournament/editions/${editionId}/blueshell`;

    const call = async (fn: () => Promise<any>) => {
        setError('');
        try {
            await fn();
            onChanged();
            return true;
        } catch (err: any) {
            setError(err?.response?.data?.message || 'No se pudo guardar');
            return false;
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 4xl:gap-6">
            {error && (
                <p className="xl:col-span-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </p>
            )}
            <PunishmentsCard base={base} punishments={punishments} call={call} />
            <TriggersCard base={base} isFortnite={isFortnite} itemName={itemName} triggers={triggers} call={call} />
        </div>
    );
}

function PunishmentsCard({ base, punishments, call }: { base: string; punishments: CatalogPunishment[]; call: (fn: () => Promise<any>) => Promise<boolean> }) {
    const [editing, setEditing] = useState<number | 'new' | null>(null);
    const [name, setName] = useState('');
    const [allowsReverse, setAllowsReverse] = useState(true);
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);

    const start = (p: CatalogPunishment | null) => {
        setEditing(p ? p.id : 'new');
        setName(p?.name ?? '');
        setAllowsReverse(p?.allowsReverse ?? true);
        setIsActive(p?.isActive ?? true);
    };

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const body = { name, allowsReverse, isActive };
        const ok = await call(() => (editing === 'new' ? api.post(`${base}/punishments`, body) : api.put(`${base}/punishments/${editing}`, body)));
        setSaving(false);
        if (ok) setEditing(null);
    };

    const form = (
        <form onSubmit={save} className="p-3 rounded-lg bg-[#f8fafc] dark:bg-[#262626] space-y-2">
            <div>
                <label className={label}>Castigo</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={150} className={input} placeholder="Ej: solo escopetas" />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#1e293b] dark:text-[#f8fafc]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={allowsReverse} onChange={(e) => setAllowsReverse(e.target.checked)} /> Puede rebotar (reverse)
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Activo
                </label>
            </div>
            <div className="flex gap-2">
                <button type="submit" disabled={saving} className={btnPrimary}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
                </button>
                <button type="button" onClick={() => setEditing(null)} className={btnGhost}>
                    <X className="w-4 h-4" />
                </button>
            </div>
        </form>
    );

    return (
        <section className="p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151] space-y-2">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">Castigos ({punishments.length})</h3>
                {editing == null && (
                    <button type="button" onClick={() => start(null)} className={btnPrimary}>
                        <Plus className="w-4 h-4" /> Agregar
                    </button>
                )}
            </div>
            {editing === 'new' && form}
            {punishments.map((p) =>
                editing === p.id ? (
                    <div key={p.id}>{form}</div>
                ) : (
                    <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#f8fafc] dark:bg-[#262626]">
                        <span className={`text-sm 4xl:text-base ${p.isActive ? 'text-[#1e293b] dark:text-[#f8fafc]' : 'text-[#94a3b8] line-through'}`}>
                            {p.name}
                            {!p.allowsReverse && <span className="ml-1.5 text-[11px] text-[#64748b]">(sin reverse)</span>}
                        </span>
                        <span className="flex items-center flex-shrink-0">
                            <button type="button" onClick={() => start(p)} className={btnGhost} title="Editar">
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => window.confirm(`¿Borrar "${p.name}"? Si ya se usó, queda desactivado.`) && call(() => api.delete(`${base}/punishments/${p.id}`))}
                                className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-red-600"
                                title="Borrar"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </span>
                    </div>
                ),
            )}
        </section>
    );
}

function TriggersCard({
    base,
    isFortnite,
    itemName,
    triggers,
    call,
}: {
    base: string;
    isFortnite: boolean;
    itemName: string;
    triggers: CatalogTrigger[];
    call: (fn: () => Promise<any>) => Promise<boolean>;
}) {
    const conditions = isFortnite ? FORTNITE_CONDITIONS : LOL_CONDITIONS;
    const firstType = Object.keys(conditions)[0];
    const [editing, setEditing] = useState<number | 'new' | null>(null);
    const [draft, setDraft] = useState<Omit<CatalogTrigger, 'id'>>({
        name: '',
        conditionType: firstType,
        statField: 'kills',
        thresholdValue: 1,
        streakLength: 3,
        shellsGranted: 1,
        isActive: true,
    });
    const [saving, setSaving] = useState(false);

    const start = (t: CatalogTrigger | null) => {
        setEditing(t ? t.id : 'new');
        setDraft(
            t
                ? { ...t, statField: t.statField ?? 'kills', streakLength: t.streakLength ?? 3 }
                : { name: '', conditionType: firstType, statField: 'kills', thresholdValue: 1, streakLength: 3, shellsGranted: 1, isActive: true },
        );
    };

    const def = conditions[draft.conditionType];

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const ok = await call(() => (editing === 'new' ? api.post(`${base}/triggers`, draft) : api.put(`${base}/triggers/${editing}`, draft)));
        setSaving(false);
        if (ok) setEditing(null);
    };

    const form = (
        <form onSubmit={save} className="p-3 rounded-lg bg-[#f8fafc] dark:bg-[#262626] space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                    <label className={label}>Nombre</label>
                    <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={150} className={input} />
                </div>
                <div>
                    <label className={label}>Condición</label>
                    <select value={draft.conditionType} onChange={(e) => setDraft({ ...draft, conditionType: e.target.value })} className={input}>
                        {Object.entries(conditions).map(([id, c]) => (
                            <option key={id} value={id}>
                                {c.label}
                            </option>
                        ))}
                    </select>
                </div>
                {def?.stat && (
                    <div>
                        <label className={label}>Estadística</label>
                        <select value={draft.statField ?? 'kills'} onChange={(e) => setDraft({ ...draft, statField: e.target.value })} className={input}>
                            {Object.entries(STAT_LABELS).map(([id, l]) => (
                                <option key={id} value={id}>
                                    {l}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {def?.valueLabel && (
                    <div>
                        <label className={label}>{def.valueLabel}</label>
                        <input
                            type="number"
                            min={0}
                            value={draft.thresholdValue}
                            onChange={(e) => setDraft({ ...draft, thresholdValue: Number(e.target.value) })}
                            className={input}
                        />
                    </div>
                )}
                {def?.streak && (
                    <div>
                        <label className={label}>Partidas seguidas</label>
                        <input
                            type="number"
                            min={2}
                            max={20}
                            value={draft.streakLength ?? 3}
                            onChange={(e) => setDraft({ ...draft, streakLength: Number(e.target.value) })}
                            className={input}
                        />
                    </div>
                )}
                <div>
                    <label className={label}>{itemName}s que da</label>
                    <input
                        type="number"
                        min={1}
                        max={10}
                        value={draft.shellsGranted}
                        onChange={(e) => setDraft({ ...draft, shellsGranted: Number(e.target.value) })}
                        className={input}
                    />
                </div>
            </div>
            <label className="flex items-center gap-1.5 text-sm text-[#1e293b] dark:text-[#f8fafc] cursor-pointer">
                <input type="checkbox" checked={draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Activa
            </label>
            <div className="flex gap-2">
                <button type="submit" disabled={saving} className={btnPrimary}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
                </button>
                <button type="button" onClick={() => setEditing(null)} className={btnGhost}>
                    <X className="w-4 h-4" />
                </button>
            </div>
        </form>
    );

    return (
        <section className="p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151] space-y-2">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">Cómo se ganan ({triggers.length})</h3>
                {editing == null && (
                    <button type="button" onClick={() => start(null)} className={btnPrimary}>
                        <Plus className="w-4 h-4" /> Agregar
                    </button>
                )}
            </div>
            {isFortnite && (
                <p className="text-[11px] 4xl:text-xs text-[#64748b] dark:text-[#94a3b8]">
                    Se evalúan con los resultados aprobados: al cerrar cada partida (victoria, eliminaciones, rachas) y al terminar cada sesión (remontada). Las
                    fichas son del equipo.
                </p>
            )}
            {editing === 'new' && form}
            {triggers.map((t) =>
                editing === t.id ? (
                    <div key={t.id}>{form}</div>
                ) : (
                    <div key={t.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#f8fafc] dark:bg-[#262626]">
                        <span className="min-w-0">
                            <span className={`block text-sm 4xl:text-base ${t.isActive ? 'text-[#1e293b] dark:text-[#f8fafc]' : 'text-[#94a3b8] line-through'}`}>{t.name}</span>
                            <span className="block text-[11px] 4xl:text-xs text-[#64748b] dark:text-[#94a3b8]">
                                {describeTrigger(t, isFortnite)} · da {t.shellsGranted}
                            </span>
                        </span>
                        <span className="flex items-center flex-shrink-0">
                            <button type="button" onClick={() => start(t)} className={btnGhost} title="Editar">
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => window.confirm(`¿Borrar "${t.name}"? Si ya dio fichas, queda desactivada.`) && call(() => api.delete(`${base}/triggers/${t.id}`))}
                                className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-red-600"
                                title="Borrar"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </span>
                    </div>
                ),
            )}
        </section>
    );
}
