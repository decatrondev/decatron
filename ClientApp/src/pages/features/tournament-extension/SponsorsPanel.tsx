import React, { useEffect, useState } from 'react';
import { Handshake, Plus, Trash2, Archive, RotateCcw, Loader2, Pencil } from 'lucide-react';
import api from '../../../services/api';
import { EditionPicker } from './shared';
import type { TournamentEdition } from './shared';

// Milestone 1 — sponsors, alta manual. Ver .dev/torneos/06-premios-pagos-sponsors.md #3.
// Sin leads publicos ni metricas de impresiones todavia (Milestone 5).
// Edicion de sponsors ya creados agregada 24-08-2026 (pedido del usuario, antes
// solo se podia crear/borrar/archivar).

interface Sponsor {
    id: number;
    name: string;
    logoUrl: string | null;
    ctaText: string | null;
    ctaUrl: string | null;
    amountSponsored: number | null;
    status: string;
    slots: string[];
}

const SLOT_LABELS: Record<string, string> = {
    'home-banner': 'Banner del home',
    prizes: 'Sección premios',
    footer: 'Pie de página',
};

export default function SponsorsPanel({
    edition,
    editions,
    onSelectEdition,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
}) {
    const [sponsors, setSponsors] = useState<Sponsor[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    const load = async (editionId: number) => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/tournament/editions/${editionId}/sponsors`);
            setSponsors(res.data.sponsors || []);
        } catch (err) {
            console.error('Error cargando sponsors', err);
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

    const toggleStatus = async (s: Sponsor) => {
        try {
            await api.put(`/admin/tournament/sponsors/${s.id}/status`, { status: s.status === 'active' ? 'archived' : 'active' });
            await load(edition.id);
        } catch (err) {
            console.error('Error cambiando estado', err);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Borrar este sponsor?')) return;
        try {
            await api.delete(`/admin/tournament/sponsors/${id}`);
            await load(edition.id);
        } catch (err) {
            console.error('Error borrando sponsor', err);
        }
    };

    return (
        <div className="space-y-4 4xl:space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <Handshake className="w-5 h-5 text-[#2563eb]" /> Sponsors — {edition.name}
                </h2>
                <button
                    onClick={() => { setShowForm((v) => !v); setEditingId(null); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb]"
                >
                    <Plus className="w-4 h-4" /> Nuevo sponsor
                </button>
            </div>

            <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                Alta manual — la bandeja de solicitudes públicas ("¿Querés ser sponsor?") es un módulo aparte, todavía no implementado.
            </p>

            {showForm && (
                <SponsorForm
                    editionId={edition.id}
                    initial={null}
                    onDone={() => {
                        setShowForm(false);
                        load(edition.id);
                    }}
                    onCancel={() => setShowForm(false)}
                />
            )}

            {loading ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Cargando...</p>
            ) : sponsors.length === 0 ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Sin sponsors cargados todavia.</p>
            ) : (
                <div className="space-y-1.5">
                    {sponsors.map((s) =>
                        editingId === s.id ? (
                            <SponsorForm
                                key={s.id}
                                editionId={edition.id}
                                initial={s}
                                onDone={() => {
                                    setEditingId(null);
                                    load(edition.id);
                                }}
                                onCancel={() => setEditingId(null)}
                            />
                        ) : (
                            <div
                                key={s.id}
                                className={`p-3 4xl:p-5 rounded-xl border border-[#e2e8f0] dark:border-[#374151] flex items-center justify-between ${s.status === 'archived' ? 'opacity-50' : ''}`}
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{s.name}</span>
                                        {s.status === 'archived' && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]">
                                                archivado
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8] mt-0.5">
                                        {s.slots.map((sl) => SLOT_LABELS[sl] || sl).join(' · ') || 'sin slots asignados'}
                                        {s.amountSponsored ? ` · $${s.amountSponsored.toLocaleString()}` : ''}
                                        {s.ctaUrl ? ` · ${s.ctaUrl}` : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => { setEditingId(s.id); setShowForm(false); }}
                                        title="Editar"
                                        className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => toggleStatus(s)}
                                        title={s.status === 'active' ? 'Archivar' : 'Reactivar'}
                                        className="p-1.5 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                                    >
                                        {s.status === 'active' ? <Archive className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(s.id)}
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

function SponsorForm({
    editionId, initial, onDone, onCancel,
}: { editionId: number; initial: Sponsor | null; onDone: () => void; onCancel: () => void }) {
    const [name, setName] = useState(initial?.name || '');
    const [logoUrl, setLogoUrl] = useState(initial?.logoUrl || '');
    const [ctaText, setCtaText] = useState(initial?.ctaText || '');
    const [ctaUrl, setCtaUrl] = useState(initial?.ctaUrl || '');
    const [amount, setAmount] = useState(initial?.amountSponsored != null ? String(initial.amountSponsored) : '');
    const [slots, setSlots] = useState<string[]>(initial?.slots || ['home-banner']);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const toggleSlot = (slot: string) => {
        setSlots((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        const payload = {
            name,
            logoUrl: logoUrl || null,
            ctaText: ctaText || null,
            ctaUrl: ctaUrl || null,
            amountSponsored: amount ? Number(amount) : null,
            slots,
        };
        try {
            if (initial) {
                await api.put(`/admin/tournament/sponsors/${initial.id}`, payload);
            } else {
                await api.post(`/admin/tournament/editions/${editionId}/sponsors`, payload);
            }
            onDone();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Error guardando el sponsor');
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
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Logo (URL)</label>
                    <input
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Texto del botón</label>
                    <input
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        placeholder="Visitar sitio"
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Link del botón</label>
                    <input
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                        placeholder="www.tusitio.com"
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                    <p className="text-[10px] text-[#94a3b8] mt-0.5">No hace falta poner "https://" — se agrega solo si falta.</p>
                </div>
                <div>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Monto patrocinado (informativo)</label>
                    <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Dónde aparece</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {Object.entries(SLOT_LABELS).map(([slot, label]) => (
                            <label key={slot} className="flex items-center gap-1.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
                                <input type="checkbox" checked={slots.includes(slot)} onChange={() => toggleSlot(slot)} />
                                {label}
                            </label>
                        ))}
                    </div>
                </div>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex items-center gap-2">
                <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-[#16a34a] text-white text-sm font-bold hover:bg-[#15803d] disabled:opacity-50 flex items-center gap-1.5"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (initial ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                    {initial ? 'Guardar cambios' : 'Crear'}
                </button>
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#475569] dark:text-[#94a3b8] text-sm font-bold">
                    Cancelar
                </button>
            </div>
        </form>
    );
}
