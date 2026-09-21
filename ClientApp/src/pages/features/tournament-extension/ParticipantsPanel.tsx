import React, { useEffect, useState } from 'react';
import { Plus, Loader2, Check, AlertTriangle, Monitor, Copy, Sprout } from 'lucide-react';
import api from '../../../services/api';
import { EditionPicker } from './shared';
import type { TournamentEdition } from './shared';

// Pestaña "Participantes". Separado de TournamentConfig.tsx el 15-08-2026.

interface TournamentParticipant {
    id: number;
    displayName: string;
    riotId: string | null;
    riotTagLine: string | null;
    primaryRole: string | null;
    status: string;
}

const PARTICIPANT_STATUS_LABELS: Record<string, string> = {
    pending_approval: 'Pendiente',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    checked_in: 'Check-in hecho',
    active: 'Activo',
    eliminated: 'Eliminado',
    withdrawn: 'Retirado',
};

const OVERLAY_WIDGET_LABELS: Record<string, string> = {
    'lp-actual': 'LP actual',
    'shell-inventory': 'Inventario',
    'castigo-activo': 'Castigo activo',
    racha: 'Racha',
};

export default function ParticipantsPanel({
    edition,
    editions,
    onSelectEdition,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
}) {
    const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
    const [pending, setPending] = useState<TournamentParticipant[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [riotId, setRiotId] = useState('');
    const [riotTagLine, setRiotTagLine] = useState('');
    const [primaryRole, setPrimaryRole] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [seedCount, setSeedCount] = useState(50);
    const [seeding, setSeeding] = useState(false);
    const [seedMessage, setSeedMessage] = useState('');

    const load = async (editionId: number) => {
        setLoading(true);
        try {
            const [pRes, pendRes] = await Promise.all([
                api.get(`/admin/tournament/editions/${editionId}/participants`),
                api.get(`/admin/tournament/editions/${editionId}/registrations`),
            ]);
            setParticipants(pRes.data.participants || []);
            setPending(pendRes.data.pending || []);
        } catch (err) {
            console.error('Error cargando participantes', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (edition) load(edition.id);
    }, [edition?.id]);

    const handleApprove = async (id: number) => {
        try {
            await api.post(`/admin/tournament/participants/${id}/approve`);
            if (edition) await load(edition.id);
        } catch (err) {
            console.error('Error aprobando', err);
        }
    };

    const handleReject = async (id: number) => {
        if (!window.confirm('Rechazar esta inscripción?')) return;
        try {
            await api.post(`/admin/tournament/participants/${id}/reject`);
            if (edition) await load(edition.id);
        } catch (err) {
            console.error('Error rechazando', err);
        }
    };

    if (!edition) {
        return <EditionPicker editions={editions} onSelectEdition={onSelectEdition} />;
    }

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            await api.post(`/admin/tournament/editions/${edition.id}/participants`, {
                displayName,
                riotId: riotId || null,
                riotTagLine: riotTagLine || null,
                primaryRole: primaryRole || null,
            });
            setDisplayName('');
            setRiotId('');
            setRiotTagLine('');
            setPrimaryRole('');
            setShowForm(false);
            await load(edition.id);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Error agregando participante');
        } finally {
            setSaving(false);
        }
    };

    const handleSeedTest = async () => {
        setSeeding(true);
        setSeedMessage('');
        try {
            const res = await api.post(`/admin/tournament/editions/${edition.id}/participants/seed-test`, { count: seedCount });
            setSeedMessage(`${res.data.created} participante(s) de prueba creados.`);
            await load(edition.id);
        } catch (err: any) {
            setSeedMessage(err?.response?.data?.message || 'Error sembrando participantes de prueba');
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div className="space-y-4 4xl:space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc]">Participantes — {edition.name}</h2>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#f8fafc] dark:bg-[#262626] border border-[#e2e8f0] dark:border-[#374151]">
                        <Sprout className="w-4 h-4 text-[#64748b] dark:text-[#94a3b8]" />
                        <input
                            type="number"
                            min={1}
                            max={200}
                            value={seedCount}
                            onChange={(e) => setSeedCount(Number(e.target.value) || 1)}
                            className="w-14 bg-transparent text-[#1e293b] dark:text-[#f8fafc] text-sm text-center outline-none"
                        />
                        <button
                            onClick={handleSeedTest}
                            disabled={seeding}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151] disabled:opacity-50"
                        >
                            {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            Sembrar participantes de prueba
                        </button>
                    </div>
                    <button
                        onClick={() => setShowForm((v) => !v)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb]"
                    >
                        <Plus className="w-4 h-4" /> Agregar
                    </button>
                </div>
            </div>

            {seedMessage && <p className="text-xs 4xl:text-sm text-[#2563eb]">{seedMessage}</p>}

            <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                El botón "Agregar" es alta manual — entra directo como aprobado. Las inscripciones que llegan del formulario público quedan abajo, pendientes de
                tu aprobación. Desde esta sesión, cada participante se inscribe con su propia cuenta y vincula/verifica su Riot y genera su overlay desde su
                propio panel ("Mi inscripción" en la web pública) — el overlay que armás acá abajo sigue funcionando como respaldo para quien lo necesite.
            </p>

            {pending.length > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-bold text-amber-600 dark:text-amber-400">Pendientes de aprobación ({pending.length})</h3>
                    {pending.map((p) => (
                        <div
                            key={p.id}
                            className="p-3 4xl:p-5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 flex items-center justify-between"
                        >
                            <div>
                                <span className="font-bold text-[#1e293b] dark:text-[#f8fafc] text-sm">{p.displayName}</span>
                                {p.riotId && (
                                    <span className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8] ml-2">
                                        {p.riotId}#{p.riotTagLine}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleApprove(p.id)}
                                    className="px-3 py-1.5 rounded-lg bg-[#16a34a] text-white text-xs font-bold hover:bg-[#15803d]"
                                >
                                    Aprobar
                                </button>
                                <button
                                    onClick={() => handleReject(p.id)}
                                    className="px-3 py-1.5 rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] text-xs font-bold hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                                >
                                    Rechazar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showForm && (
                <form onSubmit={handleAdd} className="p-4 rounded-xl bg-[#f8fafc] dark:bg-[#262626] space-y-3 border border-[#e2e8f0] dark:border-[#374151]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Nombre publico</label>
                            <input
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                required
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Rol principal</label>
                            <select
                                value={primaryRole}
                                onChange={(e) => setPrimaryRole(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                            >
                                <option value="">—</option>
                                <option value="top">Top</option>
                                <option value="jungle">Jungla</option>
                                <option value="mid">Mid</option>
                                <option value="adc">Adc</option>
                                <option value="support">Support</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Riot ID (nombre)</label>
                            <input
                                value={riotId}
                                onChange={(e) => setRiotId(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                placeholder="Faker"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8]">Tag (sin #)</label>
                            <input
                                value={riotTagLine}
                                onChange={(e) => setRiotTagLine(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                                placeholder="KR1"
                            />
                        </div>
                    </div>
                    {error && (
                        <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" /> {error}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-[#16a34a] text-white text-sm font-bold hover:bg-[#15803d] disabled:opacity-50 flex items-center gap-1.5"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Guardar
                    </button>
                </form>
            )}

            {loading ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Cargando...</p>
            ) : participants.length === 0 ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Sin participantes todavia.</p>
            ) : (
                <div className="space-y-2">
                    {participants.map((p) => (
                        <div key={p.id} className="p-3 4xl:p-5 rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{p.displayName}</span>
                                    {p.riotId && (
                                        <span className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8] ml-2">
                                            {p.riotId}#{p.riotTagLine}
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]">
                                    {PARTICIPANT_STATUS_LABELS[p.status] || p.status}
                                </span>
                            </div>
                            {edition.mode === 'solo_q_climb' && (
                                <ParticipantOverlayControl editionId={edition.id} participantId={p.id} shellItemName={edition.shellItemName} />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ParticipantOverlayControl({ editionId, participantId, shellItemName }: { editionId: number; participantId: number; shellItemName: string }) {
    const [open, setOpen] = useState(false);
    const [configured, setConfigured] = useState(false);
    const [url, setUrl] = useState('');
    const [widgets, setWidgets] = useState<string[]>(['lp-actual', 'shell-inventory', 'racha']);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/admin/tournament/editions/${editionId}/participants/${participantId}/overlay`);
            setConfigured(res.data.configured);
            if (res.data.configured) {
                setUrl(res.data.url);
                setWidgets(res.data.enabledWidgets);
            }
        } catch (err) {
            console.error('Error cargando overlay', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleOpen = () => {
        if (!open) load();
        setOpen((v) => !v);
    };

    const toggleWidget = (w: string) => setWidgets((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]));

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const res = await api.post(`/admin/tournament/editions/${editionId}/participants/${participantId}/overlay`, {
                enabledWidgets: widgets,
                theme: 'dark',
            });
            setUrl(res.data.url);
            setConfigured(true);
        } catch (err) {
            console.error('Error generando overlay', err);
        } finally {
            setLoading(false);
        }
    };

    const fullUrl = url ? `${window.location.origin}${url}` : '';

    const copyUrl = () => {
        navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="mt-2 pt-2 border-t border-[#e2e8f0] dark:border-[#374151]">
            <button onClick={toggleOpen} className="flex items-center gap-1.5 text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb]">
                <Monitor className="w-3.5 h-3.5" /> Overlay para OBS
            </button>
            {open && (
                <div className="mt-2 space-y-2">
                    {loading && !configured ? (
                        <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">Cargando...</p>
                    ) : (
                        <>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(OVERLAY_WIDGET_LABELS).map(([w, label]) => (
                                    <label key={w} className="flex items-center gap-1 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                                        <input type="checkbox" checked={widgets.includes(w)} onChange={() => toggleWidget(w)} />
                                        {w === 'shell-inventory' ? shellItemName + 's' : label}
                                    </label>
                                ))}
                            </div>
                            {configured && url && (
                                <div className="flex items-center gap-1.5">
                                    <code className="text-[10px] px-2 py-1 rounded bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] truncate max-w-[240px]">
                                        {fullUrl}
                                    </code>
                                    <button onClick={copyUrl} className="p-1 rounded text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb]">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    {copied && <span className="text-[10px] text-[#2563eb]">copiado</span>}
                                </div>
                            )}
                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white font-bold hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50"
                            >
                                {configured ? 'Regenerar link' : 'Generar link de overlay'}
                            </button>
                            {configured && (
                                <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">Regenerar invalida el link anterior — usalo solo si se filtró.</p>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
