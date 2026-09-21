import React, { useEffect, useState } from 'react';
import { DollarSign, Plus, Trash2, Trophy, Loader2, Pencil } from 'lucide-react';
import api from '../../../services/api';
import { EditionPicker } from './shared';
import type { TournamentEdition } from './shared';

// Milestone 1 — premios. Ver .dev/torneos/06-premios-pagos-sponsors.md.
// Cobertura parcial: una sola tabla (por puesto/rol/metrica/libre), sin sponsors
// atados, sin records de partida, sin pagos todavia — ver .dev/torneos/ESTADO.md.
// Edicion de premios ya creados + scope "custom" agregados 24-08-2026 (pedido del
// usuario: mas flexible, no solo elegir entre las 3 opciones fijas).

interface Leader {
    participantId: number | null;
    displayName: string | null;
    value: number | null;
}

interface Prize {
    id: number;
    name: string;
    description: string | null;
    amount: number | null;
    amountHidden: boolean;
    scope: string;
    rank: number | null;
    role: string | null;
    metricKey: string | null;
    leader: Leader | null;
}

const SCOPE_LABELS: Record<string, string> = {
    by_rank: 'Por puesto',
    by_role: 'Por rol',
    by_metric: 'Por metrica',
    custom: 'Libre (vos decidís)',
};

const ROLES = [
    { value: 'top', label: 'Top' },
    { value: 'jungle', label: 'Jungla' },
    { value: 'mid', label: 'Mid' },
    { value: 'adc', label: 'Adc' },
    { value: 'support', label: 'Support' },
];

export default function PrizesPanel({
    edition,
    editions,
    onSelectEdition,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
}) {
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [availableMetrics, setAvailableMetrics] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const load = async (editionId: number) => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/tournament/editions/${editionId}/prizes`);
            setPrizes(res.data.prizes || []);
            setAvailableMetrics(res.data.availableMetrics || {});
        } catch (err) {
            console.error('Error cargando premios', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (edition) load(edition.id);
        setShowForm(false);
        setEditingId(null);
    }, [edition?.id]);

    if (!edition) {
        return <EditionPicker editions={editions} onSelectEdition={onSelectEdition} />;
    }

    const handleDelete = async (id: number) => {
        if (!window.confirm('Borrar este premio?')) return;
        try {
            await api.delete(`/admin/tournament/prizes/${id}`);
            await load(edition.id);
        } catch (err) {
            console.error('Error borrando premio', err);
        }
    };

    const totalAmount = prizes.reduce((sum, p) => sum + (p.amount || 0), 0);

    return (
        <div className="space-y-4 4xl:space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-[#2563eb]" /> Premios — {edition.name}
                </h2>
                <button
                    onClick={() => { setShowForm((v) => !v); setEditingId(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb]"
                >
                    <Plus className="w-4 h-4" /> Nuevo premio
                </button>
            </div>

            {totalAmount > 0 && (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">
                    Bolsa total en dinero cargada: <span className="font-black text-[#1e293b] dark:text-[#f8fafc]">${totalAmount.toLocaleString()}</span>
                </p>
            )}

            {showForm && (
                <PrizeForm
                    editionId={edition.id}
                    initial={null}
                    availableMetrics={availableMetrics}
                    isAram={edition.mode === 'aram_teams'}
                    onDone={() => {
                        setShowForm(false);
                        load(edition.id);
                    }}
                    onCancel={() => setShowForm(false)}
                />
            )}

            {loading ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Cargando...</p>
            ) : prizes.length === 0 ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Sin premios cargados todavia.</p>
            ) : (
                <div className="space-y-1.5">
                    {prizes.map((p) =>
                        editingId === p.id ? (
                            <PrizeForm
                                key={p.id}
                                editionId={edition.id}
                                initial={p}
                                availableMetrics={availableMetrics}
                                isAram={edition.mode === 'aram_teams'}
                                onDone={() => {
                                    setEditingId(null);
                                    load(edition.id);
                                }}
                                onCancel={() => setEditingId(null)}
                            />
                        ) : (
                            <div key={p.id} className="flex items-center justify-between p-3 4xl:p-5 rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{p.name}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]">
                                            {SCOPE_LABELS[p.scope] || p.scope}
                                            {p.scope === 'by_rank' && p.rank ? ` #${p.rank}` : ''}
                                            {p.scope === 'by_role' && p.role ? ` — ${p.role}` : ''}
                                            {p.scope === 'by_metric' && p.metricKey ? ` — ${availableMetrics[p.metricKey] || p.metricKey}` : ''}
                                        </span>
                                    </div>
                                    {p.description && <p className="text-xs 4xl:text-sm text-[#475569] dark:text-[#cbd5e1] mt-1">{p.description}</p>}
                                    {p.leader?.displayName && (
                                        <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                                            Lider actual: <span className="font-bold text-[#2563eb]">{p.leader.displayName}</span> ({p.leader.value})
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-black text-[#1e293b] dark:text-[#f8fafc]">
                                        {p.amountHidden ? '???' : p.amount != null ? `$${p.amount.toLocaleString()}` : ''}
                                    </span>
                                    <button
                                        onClick={() => { setEditingId(p.id); setShowForm(false); }}
                                        title="Editar"
                                        className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb]"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(p.id)}
                                        className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 dark:hover:text-red-400"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ),
                    )}
                </div>
            )}
        </div>
    );
}

function PrizeForm({
    editionId, initial, availableMetrics, isAram, onDone, onCancel,
}: { editionId: number; initial: Prize | null; availableMetrics: Record<string, string>; isAram: boolean; onDone: () => void; onCancel: () => void }) {
    const [name, setName] = useState(initial?.name || '');
    const [description, setDescription] = useState(initial?.description || '');
    const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
    const [amountHidden, setAmountHidden] = useState(initial?.amountHidden || false);
    const [scope, setScope] = useState(initial?.scope || 'by_rank');
    const [rank, setRank] = useState(initial?.rank != null ? String(initial.rank) : '1');
    const [role, setRole] = useState(initial?.role || 'top');
    const [metricKey, setMetricKey] = useState(initial?.metricKey || 'most_kills');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        const payload = {
            name,
            description: description || null,
            amount: amount ? Number(amount) : null,
            amountHidden,
            scope,
            rank: scope === 'by_rank' ? Number(rank) : null,
            role: scope === 'by_role' ? role : null,
            metricKey: scope === 'by_metric' ? metricKey : null,
        };
        try {
            if (initial) {
                await api.put(`/admin/tournament/prizes/${initial.id}`, payload);
            } else {
                await api.post(`/admin/tournament/editions/${editionId}/prizes`, payload);
            }
            onDone();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Error guardando el premio');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Nombre</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        placeholder="Ganador, Mejor Top, Mas kills..."
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Qué es el premio (opcional)</label>
                    <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="No tiene que ser plata: skin, suscripción, merch, trofeo, mouse gamer..."
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Cómo se decide el ganador</label>
                    <select
                        value={scope}
                        onChange={(e) => setScope(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    >
                        <option value="by_rank">Por puesto en el ranking</option>
                        {!isAram && <option value="by_role">Por rol</option>}
                        <option value="by_metric">Por metrica (mas kills, racha, etc.)</option>
                        <option value="custom">Libre — yo decido a mano quién gana</option>
                    </select>
                </div>

                {scope === 'by_rank' && (
                    <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Puesto</label>
                        <input
                            type="number"
                            min={1}
                            value={rank}
                            onChange={(e) => setRank(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                        />
                    </div>
                )}
                {scope === 'by_role' && (
                    <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Rol</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                        >
                            {ROLES.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {scope === 'by_metric' && (
                    <div>
                        <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Metrica</label>
                        <select
                            value={metricKey}
                            onChange={(e) => setMetricKey(e.target.value)}
                            className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                        >
                            {Object.entries(availableMetrics).map(([key, label]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {scope === 'custom' && (
                    <div className="flex items-center">
                        <p className="text-xs text-[#94a3b8]">Sin seguimiento automático — vos marcás quién lo ganó cuando corresponda.</p>
                    </div>
                )}

                <div>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Importe en dinero (opcional)</label>
                    <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                </div>
                <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
                        <input type="checkbox" checked={amountHidden} onChange={(e) => setAmountHidden(e.target.checked)} />
                        Ocultar importe al publico ("???")
                    </label>
                </div>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex items-center gap-2">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-[#16a34a] text-white text-sm font-bold hover:bg-[#15803d] disabled:opacity-50 flex items-center gap-1.5"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (initial ? <Pencil className="w-4 h-4" /> : <DollarSign className="w-4 h-4" />)}
                    {initial ? 'Guardar cambios' : 'Crear'}
                </button>
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#475569] dark:text-[#94a3b8] text-sm font-bold">
                    Cancelar
                </button>
            </div>
        </form>
    );
}
