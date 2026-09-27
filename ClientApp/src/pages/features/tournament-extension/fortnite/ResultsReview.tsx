import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, Check, CheckCheck, PencilLine, ShieldAlert, RotateCcw, Paperclip } from 'lucide-react';
import api from '../../../../services/api';
import AuthImage from '../../../../components/tournament/AuthImage';
import { RESULT_FLAG_LABELS, RESULT_STATUS_LABELS, inputClass, labelClass, primaryButton, secondaryButton } from './types';

// Revision de resultados de una partida de Fortnite (.dev/torneos/15-fortnite.md
// F4): lo que reporto cada jugador con su captura, alertas, y aprobar, corregir o
// rechazar. Cargar o corregir a nombre de un equipo pide motivo y justificante.

interface ReviewMember {
    participantId: number;
    displayName: string;
    gameAccountName: string | null;
    reported: boolean;
    placement: number | null;
    eliminations: number | null;
    screenshotFileId: number | null;
}

interface ReviewTeam {
    teamId: number;
    teamName: string;
    members: ReviewMember[];
    reportedPlacement: number | null;
    reportedEliminations: number;
    flags: string[];
    points: number | null;
    result: { status: string; placement: number | null; eliminations: number; source: string } | null;
}

interface Review {
    game: { id: number; gameNumber: number; status: string };
    proofMode: string;
    deadline: string | null;
    gameFlags: string[];
    teams: ReviewTeam[];
}

interface EditRow {
    teamId: number;
    status: 'approved' | 'rejected' | 'reopen';
    placement: string;
    eliminations: string;
}

function toDate(iso: string | null) {
    if (!iso) return null;
    return new Date(iso.endsWith('Z') ? iso : iso + 'Z');
}

export default function ResultsReview({ base, gameId, onChanged }: { base: string; gameId: number; onChanged: () => void }) {
    const [review, setReview] = useState<Review | null>(null);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [editing, setEditing] = useState<EditRow[] | null>(null);

    const load = async () => {
        try {
            const res = await api.get(`${base}/games/${gameId}/review`);
            setReview(res.data);
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'Error cargando los resultados' });
        }
    };

    useEffect(() => {
        load();
        const t = setInterval(() => !editing && load(), 15000);
        return () => clearInterval(t);
    }, [gameId, editing == null]);

    const run = async (key: string, fn: () => Promise<string | void>) => {
        setBusy(key);
        setMessage(null);
        try {
            const text = await fn();
            if (text) setMessage({ ok: true, text });
            await load();
            onChanged();
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'No se pudo completar la acción' });
        } finally {
            setBusy(null);
        }
    };

    if (!review) return <Loader2 className="w-5 h-5 animate-spin text-[#2563eb]" />;

    const closed = review.game.status === 'closed';
    const deadline = toDate(review.deadline);
    const cleanCount = review.teams.filter((t) => !t.result && t.flags.length === 0 && t.reportedPlacement != null).length;
    const pendingCount = review.teams.filter((t) => !t.result).length;

    const startEdit = (teams: ReviewTeam[]) =>
        setEditing(
            teams.map((t) => ({
                teamId: t.teamId,
                status: t.result?.status === 'rejected' ? 'rejected' : 'approved',
                placement: String(t.result?.placement ?? t.reportedPlacement ?? ''),
                eliminations: String(t.result?.eliminations ?? t.reportedEliminations ?? 0),
            })),
        );

    return (
        <div className="space-y-3 pt-2 border-t border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                    {review.teams.length} equipo(s) · {pendingCount} sin revisar
                    {deadline && ` · reportes hasta las ${deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </p>
                {!closed && (
                    <div className="flex gap-2 flex-wrap">
                        {cleanCount > 0 && (
                            <button
                                type="button"
                                disabled={busy != null}
                                onClick={() =>
                                    run('clean', async () => {
                                        const res = await api.post(`${base}/games/${gameId}/results/approve-clean`);
                                        return `${res.data.approved} resultado(s) aprobados.`;
                                    })
                                }
                                className={primaryButton}
                            >
                                <CheckCheck className="w-4 h-4" /> Aprobar los {cleanCount} sin alertas
                            </button>
                        )}
                        <button type="button" onClick={() => startEdit(review.teams)} className={secondaryButton}>
                            <PencilLine className="w-4 h-4" /> Cargar o corregir
                        </button>
                    </div>
                )}
            </div>

            {review.gameFlags.map((f) => (
                <p key={f} className="text-xs 4xl:text-sm text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4" /> {RESULT_FLAG_LABELS[f] || f}: revisa las eliminaciones reportadas.
                </p>
            ))}
            {message && (
                <p className={`text-sm flex items-center gap-1 ${message.ok ? 'text-[#16a34a]' : 'text-red-600 dark:text-red-400'}`}>
                    {message.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {message.text}
                </p>
            )}

            {editing ? (
                <StaffEditForm base={base} gameId={gameId} teams={review.teams} rows={editing} setRows={setEditing} busy={busy} run={run} />
            ) : review.teams.length === 0 ? (
                <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Nadie hizo check-in en esta sesión.</p>
            ) : (
                <div className="space-y-2">
                    {review.teams.map((t) => (
                        <div
                            key={t.teamId}
                            className={`p-3 rounded-lg border ${
                                t.result
                                    ? 'border-green-200 dark:border-green-900'
                                    : t.flags.length > 0
                                      ? 'border-amber-300 dark:border-amber-800'
                                      : 'border-[#e2e8f0] dark:border-[#374151]'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                                <div className="min-w-0">
                                    <p className="font-bold text-sm 4xl:text-base text-[#1e293b] dark:text-[#f8fafc]">{t.teamName}</p>
                                    <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                                        Reportado: {t.reportedPlacement != null ? `puesto ${t.reportedPlacement}` : '—'} · {t.reportedEliminations} elim.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {t.result ? (
                                        <span className="text-xs 4xl:text-sm font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">
                                            {RESULT_STATUS_LABELS[t.result.status] || t.result.status}
                                            {t.result.status === 'approved' && ` · #${t.result.placement} · ${t.result.eliminations} elim. · ${t.points} pts`}
                                            {t.result.source === 'staff' && ' (organizador)'}
                                        </span>
                                    ) : (
                                        !closed && (
                                            <button
                                                type="button"
                                                disabled={busy != null || t.reportedPlacement == null}
                                                onClick={() => run(`a-${t.teamId}`, async () => void (await api.post(`${base}/games/${gameId}/results/${t.teamId}/approve`)))}
                                                className={primaryButton}
                                                title={t.reportedPlacement == null ? 'No hay un puesto en el que coincidan: corrígelo' : 'Aprobar lo reportado'}
                                            >
                                                <Check className="w-4 h-4" /> Aprobar
                                            </button>
                                        )
                                    )}
                                    {!closed && (
                                        <button type="button" onClick={() => startEdit([t])} className={secondaryButton} title="Cargar, corregir o rechazar">
                                            <PencilLine className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {t.flags.length > 0 && !t.result && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {t.flags.map((f) => (
                                        <span key={f} className="text-[11px] 4xl:text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                                            {RESULT_FLAG_LABELS[f] || f}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="mt-2 space-y-1">
                                {t.members.map((m) => (
                                    <div key={m.participantId} className="flex items-center gap-2 text-xs 4xl:text-sm text-[#475569] dark:text-[#94a3b8]">
                                        {m.screenshotFileId ? (
                                            <AuthImage url={`${base}/files/${m.screenshotFileId}`} alt={`Captura de ${m.displayName}`} className="w-14 h-9 4xl:w-20 4xl:h-12" />
                                        ) : (
                                            <span className="w-14 h-9 4xl:w-20 4xl:h-12 rounded bg-[#f8fafc] dark:bg-[#262626] flex-shrink-0" />
                                        )}
                                        <span className="font-bold text-[#1e293b] dark:text-[#f8fafc] truncate">{m.displayName}</span>
                                        {m.reported ? (
                                            <span>
                                                puesto {m.placement} · {m.eliminations} elim.
                                            </span>
                                        ) : (
                                            <span className="italic">no reportó</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function StaffEditForm({
    base,
    gameId,
    teams,
    rows,
    setRows,
    busy,
    run,
}: {
    base: string;
    gameId: number;
    teams: ReviewTeam[];
    rows: EditRow[];
    setRows: (rows: EditRow[] | null) => void;
    busy: string | null;
    run: (key: string, fn: () => Promise<string | void>) => Promise<void>;
}) {
    const [reason, setReason] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const name = (id: number) => teams.find((t) => t.teamId === id)?.teamName || `Equipo ${id}`;
    const hasResult = (id: number) => !!teams.find((t) => t.teamId === id)?.result;

    const update = (i: number, patch: Partial<EditRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        run('staff', async () => {
            const form = new FormData();
            form.append(
                'rows',
                JSON.stringify(
                    rows.map((r) => ({
                        teamId: r.teamId,
                        status: r.status,
                        placement: r.status === 'approved' ? Number(r.placement) : null,
                        eliminations: r.status === 'approved' ? Number(r.eliminations) : 0,
                    })),
                ),
            );
            form.append('reason', reason);
            files.forEach((f) => form.append('files', f));
            await api.post(`${base}/games/${gameId}/results/staff`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setRows(null);
            return 'Cambios guardados y anotados en el historial.';
        });
    };

    return (
        <form onSubmit={submit} className="p-3 4xl:p-5 rounded-lg bg-[#f8fafc] dark:bg-[#262626] space-y-3">
            <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                Quita de la lista los equipos que no quieres tocar. Cargar o corregir pide un justificante (captura); rechazar o reabrir solo el motivo. Todo queda en
                el historial que ven los participantes.
            </p>
            <div className="space-y-1.5">
                <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_80px_80px_32px] gap-2 text-[11px] font-bold uppercase font-mono text-[#64748b] dark:text-[#94a3b8]">
                    <span>Equipo</span>
                    <span>Qué hacer</span>
                    <span>Puesto</span>
                    <span>Elim.</span>
                    <span />
                </div>
                {rows.map((r, i) => (
                    <div key={r.teamId} className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)_80px_80px_32px] gap-2 items-center">
                        <span className="text-sm text-[#1e293b] dark:text-[#f8fafc] truncate">{name(r.teamId)}</span>
                        <select value={r.status} onChange={(e) => update(i, { status: e.target.value as EditRow['status'] })} className={inputClass + ' mt-0'}>
                            <option value="approved">Resultado</option>
                            <option value="rejected">Rechazar (0 pts)</option>
                            {hasResult(r.teamId) && <option value="reopen">Reabrir revisión</option>}
                        </select>
                        <input
                            type="number"
                            min={1}
                            max={100}
                            disabled={r.status !== 'approved'}
                            value={r.placement}
                            onChange={(e) => update(i, { placement: e.target.value })}
                            className={inputClass + ' mt-0 disabled:opacity-40'}
                        />
                        <input
                            type="number"
                            min={0}
                            max={99}
                            disabled={r.status !== 'approved'}
                            value={r.eliminations}
                            onChange={(e) => update(i, { eliminations: e.target.value })}
                            className={inputClass + ' mt-0 disabled:opacity-40'}
                        />
                        <button
                            type="button"
                            onClick={() => setRows(rows.filter((_, j) => j !== i).length ? rows.filter((_, j) => j !== i) : null)}
                            className="p-1 text-[#64748b] hover:text-red-600"
                            title="No tocar este equipo"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
            <div>
                <label className={labelClass}>Motivo (lo ven los participantes)</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={1000} rows={2} className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>Justificantes (capturas)</label>
                <label className="mt-1 flex items-center gap-2 text-sm text-[#2563eb] font-bold cursor-pointer">
                    <Paperclip className="w-4 h-4" />
                    {files.length > 0 ? `${files.length} archivo(s)` : 'Elegir imágenes'}
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 10))} />
                </label>
            </div>
            <div className="flex gap-2">
                <button type="submit" disabled={busy != null || !reason.trim()} className={primaryButton}>
                    {busy === 'staff' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Guardar cambios
                </button>
                <button type="button" onClick={() => setRows(null)} className={secondaryButton}>
                    <RotateCcw className="w-4 h-4" /> Cancelar
                </button>
            </div>
        </form>
    );
}
