import React, { useEffect, useState } from 'react';
import { Swords, Loader2, Check, AlertTriangle, RefreshCw, Plus, Trash2 } from 'lucide-react';
import api from '../../../services/api';
import { EditionPicker } from './shared';
import type { TournamentEdition } from './shared';

// Condiciones de victoria configurables para ARAM N vs N — Tema 2, pedido del
// usuario 24-08-2026: en vez de jugar hasta el nexo, el ganador de cada cruce del
// bracket se declara solo apenas se cumple ALGUNA de las condiciones activas (el
// motor las evalua todas contra el timeline real de la partida y se queda con la
// que paso primero — ver TournamentWinConditionEngine.cs en el backend). Empezo
// como "una sola condicion" y paso a catalogo combinable el mismo dia (pedido del
// usuario: "no es solo 1 no?"), mismo patron que el catalogo de fichas de castigo.

interface WinCondition {
    id: number;
    name: string;
    conditionType: string;
    thresholdValue: number;
    isActive: boolean;
}

const CONDITION_TYPES: { value: string; label: string; unit?: string; isMultikill?: boolean }[] = [
    { value: 'first_blood', label: 'Primera sangre' },
    { value: 'team_kills', label: 'Equipo llega a X kills totales', unit: 'kills' },
    { value: 'player_kills', label: 'Jugador llega a X kills individuales', unit: 'kills' },
    { value: 'player_kill_streak', label: 'Jugador llega a X kills seguidas sin morir', unit: 'kills seguidas' },
    { value: 'multikill', label: 'Multikill (doble / triple / cuádruple / penta)', isMultikill: true },
    { value: 'first_tower', label: 'Primera torre' },
    { value: 'team_towers', label: 'Equipo derriba X torres', unit: 'torres' },
    { value: 'first_inhibitor', label: 'Primer inhibidor' },
    { value: 'cs_threshold', label: 'Jugador llega a X súbditos (CS)', unit: 'súbditos' },
    { value: 'gold_threshold', label: 'Jugador llega a X de oro', unit: 'de oro' },
    { value: 'level_threshold', label: 'Jugador llega a nivel X', unit: 'nivel' },
    { value: 'time_lead', label: 'A los X minutos, gana el que va arriba en kills', unit: 'minutos' },
    { value: 'gold_lead', label: 'Equipo con X de oro de ventaja', unit: 'de oro de ventaja' },
    { value: 'champion_damage_threshold', label: 'Jugador hace X de daño a campeones', unit: 'de daño' },
];

const MULTIKILL_TIERS = [
    { value: 2, label: 'Doble kill' },
    { value: 3, label: 'Triple kill' },
    { value: 4, label: 'Cuádruple kill' },
    { value: 5, label: 'Penta kill' },
];

const typeLabel = (conditionType: string) => CONDITION_TYPES.find((c) => c.value === conditionType)?.label || conditionType;

function ConditionForm({
    initial, onSave, onCancel, saving,
}: {
    initial: WinCondition | null;
    onSave: (data: { name: string; conditionType: string; thresholdValue: number }) => void;
    onCancel: () => void;
    saving: boolean;
}) {
    const [name, setName] = useState(initial?.name || '');
    const [conditionType, setConditionType] = useState(initial?.conditionType || 'first_tower');
    const [thresholdValue, setThresholdValue] = useState(initial?.thresholdValue ?? 1);

    const meta = CONDITION_TYPES.find((c) => c.value === conditionType);

    return (
        <div className="p-4 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] space-y-3">
            <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">Nombre (para identificarla en la lista)</label>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Primera torre gana"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                />
            </div>
            <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">Condición</label>
                <select
                    value={conditionType}
                    onChange={(e) => { setConditionType(e.target.value); setThresholdValue(e.target.value === 'multikill' ? 2 : 1); }}
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                >
                    {CONDITION_TYPES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                </select>
            </div>

            {meta?.isMultikill && (
                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">Tier de multikill</label>
                    <select
                        value={thresholdValue}
                        onChange={(e) => setThresholdValue(Number(e.target.value))}
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    >
                        {MULTIKILL_TIERS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {meta?.unit && !meta.isMultikill && (
                <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">Número ({meta.unit})</label>
                    <input
                        type="number"
                        min={1}
                        value={thresholdValue}
                        onChange={(e) => setThresholdValue(Number(e.target.value))}
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                </div>
            )}

            <div className="flex items-center gap-2 pt-1">
                <button
                    onClick={() => onSave({ name: name || typeLabel(conditionType), conditionType, thresholdValue })}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white font-bold text-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Guardar
                </button>
                <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-white dark:bg-[#1B1C1D] text-[#475569] dark:text-[#94a3b8] font-bold text-sm">
                    Cancelar
                </button>
            </div>
        </div>
    );
}

export default function WinConditionPanel({
    edition,
    editions,
    onSelectEdition,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
}) {
    const [conditions, setConditions] = useState<WinCondition[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [resyncing, setResyncing] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const load = async (editionId: number) => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/tournament/editions/${editionId}/win-conditions`);
            setConditions(res.data.conditions || []);
        } catch (err) {
            console.error('Error cargando las condiciones de victoria', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (edition) load(edition.id);
        setAdding(false);
        setEditingId(null);
    }, [edition?.id]);

    if (!edition) {
        return <EditionPicker editions={editions} onSelectEdition={onSelectEdition} />;
    }

    if (edition.mode !== 'aram_teams') {
        return (
            <div className="p-4 rounded-lg border border-dashed border-[#e2e8f0] dark:border-[#374151] text-sm text-[#64748b] dark:text-[#94a3b8]">
                Las condiciones de victoria solo aplican a ediciones modo ARAM N vs N.
            </div>
        );
    }

    const handleCreate = async (data: { name: string; conditionType: string; thresholdValue: number }) => {
        setSaving(true);
        setMessage(null);
        try {
            await api.post(`/admin/tournament/editions/${edition.id}/win-conditions`, data);
            setAdding(false);
            await load(edition.id);
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'Error creando la condición' });
        } finally {
            setSaving(false);
        }
    };

    const handleUpdate = async (id: number, data: { name: string; conditionType: string; thresholdValue: number }, isActive: boolean) => {
        setSaving(true);
        setMessage(null);
        try {
            await api.put(`/admin/tournament/win-conditions/${id}`, { ...data, isActive });
            setEditingId(null);
            await load(edition.id);
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'Error guardando la condición' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (c: WinCondition) => {
        try {
            await api.put(`/admin/tournament/win-conditions/${c.id}`, {
                name: c.name, conditionType: c.conditionType, thresholdValue: c.thresholdValue, isActive: !c.isActive,
            });
            await load(edition.id);
        } catch (err) {
            console.error('Error activando/desactivando la condición', err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Borrar esta condición de victoria?')) return;
        try {
            await api.delete(`/admin/tournament/win-conditions/${id}`);
            await load(edition.id);
        } catch (err) {
            console.error('Error borrando la condición', err);
        }
    };

    const handleResync = async () => {
        setResyncing(true);
        setMessage(null);
        try {
            await api.post(`/admin/tournament/editions/${edition.id}/win-conditions/resync`);
            setMessage({ ok: true, text: 'Resincronizado — si alguna partida ya cumplió alguna condición activa, el bracket se actualiza solo.' });
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'Error resincronizando' });
        } finally {
            setResyncing(false);
        }
    };

    const activeCount = conditions.filter((c) => c.isActive).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Swords className="w-5 h-5 text-[#2563eb]" />
                <h2 className="text-xl font-black text-[#1e293b] dark:text-[#f8fafc]">Condiciones de victoria</h2>
            </div>
            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">
                En vez de jugar cada partida hasta destruir el nexo, el ganador del cruce del bracket se declara automáticamente apenas se cumple{' '}
                <strong>cualquiera</strong> de las condiciones activas — gana la que pase primero. Podés activar varias a la vez. El sistema revisa las
                partidas terminadas cada pocos minutos.
            </p>

            <div className="max-w-2xl space-y-3">
                {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />
                ) : (
                    <>
                        {conditions.length === 0 && !adding && (
                            <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Todavía no hay condiciones cargadas — el torneo juega normal a nexo.</p>
                        )}

                        {conditions.map((c) =>
                            editingId === c.id ? (
                                <ConditionForm
                                    key={c.id}
                                    initial={c}
                                    saving={saving}
                                    onCancel={() => setEditingId(null)}
                                    onSave={(data) => handleUpdate(c.id, data, c.isActive)}
                                />
                            ) : (
                                <div
                                    key={c.id}
                                    className={`p-4 rounded-lg border flex items-center justify-between gap-3 ${
                                        c.isActive ? 'border-[#2563eb]/40 bg-[#2563eb]/5' : 'border-[#e2e8f0] dark:border-[#374151] bg-white dark:bg-[#1B1C1D] opacity-60'
                                    }`}
                                >
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-[#1e293b] dark:text-[#f8fafc] truncate">{c.name}</p>
                                        <p className="text-xs text-[#64748b] dark:text-[#94a3b8] truncate">{typeLabel(c.conditionType)} · {c.thresholdValue}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button
                                            onClick={() => handleToggleActive(c)}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold ${
                                                c.isActive ? 'bg-[#2563eb] text-white' : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]'
                                            }`}
                                        >
                                            {c.isActive ? 'Activa' : 'Inactiva'}
                                        </button>
                                        <button onClick={() => setEditingId(c.id)} className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb]">
                                            Editar
                                        </button>
                                        <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-red-600">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ),
                        )}

                        {adding ? (
                            <ConditionForm initial={null} saving={saving} onCancel={() => setAdding(false)} onSave={handleCreate} />
                        ) : (
                            <button
                                onClick={() => setAdding(true)}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-dashed border-[#e2e8f0] dark:border-[#374151] text-sm font-bold text-[#64748b] dark:text-[#94a3b8] hover:border-[#2563eb] hover:text-[#2563eb]"
                            >
                                <Plus className="w-4 h-4" /> Agregar condición
                            </button>
                        )}
                    </>
                )}

                <div className="flex items-center gap-3 pt-2">
                    <button
                        onClick={handleResync}
                        disabled={resyncing || activeCount === 0}
                        className="px-4 py-2 rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#475569] dark:text-[#94a3b8] font-bold text-sm hover:bg-[#e2e8f0] dark:hover:bg-[#374151] disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {resyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Resincronizar ahora
                    </button>
                </div>

                {message && (
                    <p className={`text-sm flex items-center gap-1.5 ${message.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {message.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {message.text}
                    </p>
                )}
            </div>
        </div>
    );
}
