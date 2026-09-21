import React, { useState } from 'react';
import { Plus, Check, AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import api from '../../../services/api';
import type { TournamentEdition } from './shared';
import { REGIONS, REGION_LABELS } from '../../tournament-public/shared';

// Pestaña "Ediciones" — crear/listar/borrar, cambiar estado. Separado de
// TournamentConfig.tsx (que ya pasaba las 800 líneas) el 15-08-2026.
// REGIONS/REGION_LABELS movidos a tournament-public/shared.tsx el 24-08-2026
// para que la pagina publica y el panel de inscripcion los reusen en vez de
// mostrar el codigo crudo de Riot ("la1").

const MODES = [
    { value: 'solo_q_climb', label: 'SoloQ Climb (Próximamente)', disabled: true },
    { value: 'aram_teams', label: 'ARAM N vs N (equipos al azar al generar el bracket)', disabled: false },
    { value: 'clash_5v5', label: 'Grieta 5v5 (Próximamente)', disabled: true },
];
export const MODE_LABELS: Record<string, string> = Object.fromEntries(MODES.map((m) => [m.value, m.label.replace(/ \(.+\)/, '')]));

export const EDITION_STATUS_LABELS: Record<string, string> = {
    draft: 'Borrador',
    registration_open: 'Inscripciones abiertas',
    check_in: 'Check-in',
    in_progress: 'En curso',
    finished: 'Finalizado',
    archived: 'Archivado',
};

export default function EditionsPanel({
    editions,
    loadingEditions,
    selectedEditionId,
    onSelect,
    onChangeStatus,
    onDelete,
    onCreated,
}: {
    editions: TournamentEdition[];
    loadingEditions: boolean;
    selectedEditionId: number | null;
    onSelect: (id: number, goToParticipants: boolean) => void;
    onChangeStatus: (editionId: number, status: string) => void;
    onDelete: (editionId: number, name: string) => void;
    onCreated: () => Promise<void>;
}) {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newSlug, setNewSlug] = useState('');
    const [newMode, setNewMode] = useState('aram_teams');
    const [newTeamSize, setNewTeamSize] = useState(5);
    const [newRegion, setNewRegion] = useState('euw1');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const handleCreateEdition = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError('');
        setCreating(true);
        try {
            await api.post('/admin/tournament/editions', {
                name: newName,
                slug: newSlug,
                mode: newMode,
                region: newRegion,
                teamSize: newMode === 'aram_teams' ? newTeamSize : null,
            });
            setNewName('');
            setNewSlug('');
            setShowCreateForm(false);
            await onCreated();
        } catch (err: any) {
            setCreateError(err?.response?.data?.message || 'Error creando la edicion');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-4 4xl:space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc]">Ediciones</h2>
                <button
                    onClick={() => setShowCreateForm((v) => !v)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb]"
                >
                    <Plus className="w-4 h-4" /> Nueva edicion
                </button>
            </div>

            {showCreateForm && (
                <form
                    onSubmit={handleCreateEdition}
                    className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#262626] space-y-3 border border-[#e2e8f0] dark:border-[#374151]"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Nombre</label>
                            <input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                required
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                placeholder="Mi Torneo 2026"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Slug</label>
                            <input
                                value={newSlug}
                                onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                required
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                placeholder="mi-torneo-2026"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Modo</label>
                            <select
                                value={newMode}
                                onChange={(e) => setNewMode(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                            >
                                {MODES.map((m) => (
                                    <option key={m.value} value={m.value} disabled={m.disabled}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {newMode === 'aram_teams' && (
                            <div>
                                <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Tamaño de equipo (1v1 a 5v5)</label>
                                <select
                                    value={newTeamSize}
                                    onChange={(e) => setNewTeamSize(Number(e.target.value))}
                                    className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                >
                                    {[1, 2, 3, 4, 5].map((n) => (
                                        <option key={n} value={n}>
                                            {n}v{n}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Region (una sola, no se puede mezclar)</label>
                            <select
                                value={newRegion}
                                onChange={(e) => setNewRegion(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                            >
                                {REGIONS.map((r) => (
                                    <option key={r.value} value={r.value}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {createError && (
                        <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" /> {createError}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={creating}
                        className="px-4 py-2 rounded-lg bg-[#16a34a] text-white text-sm font-bold hover:bg-[#15803d] disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Crear
                    </button>
                </form>
            )}

            {loadingEditions ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Cargando...</p>
            ) : editions.length === 0 ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Todavia no hay ediciones creadas.</p>
            ) : (
                <div className="space-y-2">
                    {editions.map((ed) => (
                        <div
                            key={ed.id}
                            onClick={() => onSelect(ed.id, true)}
                            className={`w-full text-left p-4 4xl:p-6 rounded-xl border transition-all cursor-pointer ${
                                selectedEditionId === ed.id
                                    ? 'border-[#2563eb] bg-[#132A2A]'
                                    : 'border-[#e2e8f0] dark:border-[#374151] hover:border-[#e2e8f0] dark:border-[#374151]'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{ed.name}</span>
                                <select
                                    value={ed.status}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => onChangeStatus(ed.id, e.target.value)}
                                    className="text-xs px-2 py-1 rounded-full bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] border-none cursor-pointer"
                                >
                                    {Object.entries(EDITION_STATUS_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(ed.id, ed.name);
                                    }}
                                    title="Borrar edicion"
                                    className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 dark:hover:text-red-400"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
                                /{ed.slug} · {MODE_LABELS[ed.mode] || ed.mode} · {REGION_LABELS[ed.region] || ed.region}
                            </div>
                            {ed.status !== 'in_progress' && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" /> El poller de Riot API solo trackea ediciones "En curso"
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
