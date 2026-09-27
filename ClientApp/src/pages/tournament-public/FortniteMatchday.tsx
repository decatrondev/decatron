import React, { useEffect, useState } from 'react';
import { Loader2, Check, Copy, Eye, EyeOff, CalendarDays, Paperclip, AlertTriangle, History, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import AuthImage from '../../components/tournament/AuthImage';

// "Día de partida" del jugador de Fortnite (.dev/torneos/15-fortnite.md F3): sus
// sesiones, el boton de check-in y el codigo de la partida personalizada cuando el
// organizador lo revela. El codigo solo llega si hizo check-in; va oculto por
// defecto porque el jugador puede estar transmitiendo.

interface MatchdayGame {
    id: number;
    gameNumber: number;
    status: string;
    code: string | null;
    canReport: boolean;
    cannotReportReason: string | null;
    deadline: string | null;
    needsScreenshot: boolean;
    myReport: { placement: number; eliminations: number; hasScreenshot: boolean; screenshotFileId: number | null } | null;
    teamResult: { status: string; placement: number | null; eliminations: number; source: string; points: number } | null;
}

const RESULT_LABELS: Record<string, string> = {
    approved: 'Aprobado',
    rejected: 'Rechazado (0 pts)',
    no_report: 'Sin reporte (0 pts)',
};

const AUDIT_LABELS: Record<string, string> = {
    approve: 'aprobó lo reportado',
    staff_load: 'cargó el resultado',
    correct: 'corrigió el resultado',
    reject: 'rechazó el resultado',
    reopen: 'reabrió la revisión',
    no_report: 'sin reporte al cerrar',
};

interface MatchdaySession {
    id: number;
    name: string;
    status: string;
    scheduledAt: string | null;
    checkedIn: boolean;
    canCheckIn: boolean;
    games: MatchdayGame[];
}

const SESSION_LABELS: Record<string, string> = {
    scheduled: 'Programada',
    check_in: 'Check-in abierto',
    in_progress: 'En juego',
    finished: 'Terminada',
};

const GAME_LABELS: Record<string, string> = {
    waiting: 'Esperando',
    revealed: 'Código disponible',
    playing: 'En juego',
    reporting: 'Reporta tu resultado',
    closed: 'Cerrada',
};

function parseDate(iso: string | null): Date | null {
    return iso ? new Date(iso.endsWith('Z') ? iso : iso + 'Z') : null;
}

function formatDate(iso: string | null): string {
    return parseDate(iso)?.toLocaleString() ?? 'Sin fecha';
}

export default function FortniteMatchday({ channelName, editionSlug }: { channelName: string; editionSlug: string }) {
    const [sessions, setSessions] = useState<MatchdaySession[] | null>(null);
    const [proofMode, setProofMode] = useState('always');
    const [teamSize, setTeamSize] = useState(1);
    const base = `/me/tournament/${channelName}/${editionSlug}`;
    const [error, setError] = useState('');
    const [checkingIn, setCheckingIn] = useState<number | null>(null);

    const load = async () => {
        try {
            const res = await api.get(`/me/tournament/${channelName}/${editionSlug}/matchday`);
            setSessions(res.data.sessions || []);
            setProofMode(res.data.proofMode || 'always');
            setTeamSize(res.data.teamSize || 1);
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Error cargando tus partidas');
        }
    };

    // Mientras haya una sesion activa, refresca cada 10 s para que el codigo
    // aparezca solo cuando el organizador lo revela.
    const active = !!sessions?.some((s) => s.status === 'check_in' || s.status === 'in_progress');
    useEffect(() => {
        load();
    }, [channelName, editionSlug]);
    useEffect(() => {
        if (!active) return;
        const t = setInterval(load, 10000);
        return () => clearInterval(t);
    }, [active]);

    const checkIn = async (sessionId: number) => {
        setCheckingIn(sessionId);
        setError('');
        try {
            await api.post(`/me/tournament/${channelName}/${editionSlug}/sessions/${sessionId}/checkin`);
            await load();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'No se pudo hacer el check-in');
        } finally {
            setCheckingIn(null);
        }
    };

    if (sessions == null && !error) return null;

    return (
        <section className="space-y-3">
            <h2 className="font-display font-bold flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#3ED6C4]" /> Día de partida
            </h2>
            {error && <p className="text-sm text-[#E8677A]">{error}</p>}
            {sessions && sessions.length === 0 && (
                <p className="text-xs text-[#7C8AA6]">Todavía no hay sesiones para ti. El organizador las publica cuando arma el torneo.</p>
            )}
            {sessions?.map((s) => (
                <div key={s.id} className="p-4 rounded-lg border border-[#232C42] bg-[#0F1729] space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="font-display font-bold">{s.name}</p>
                            <p className="font-mono text-[11px] text-[#7C8AA6]">
                                {formatDate(s.scheduledAt)} · {SESSION_LABELS[s.status] || s.status}
                            </p>
                        </div>
                        {s.checkedIn ? (
                            <span className="flex items-center gap-1 font-mono text-xs text-[#3ED6C4] flex-shrink-0">
                                <Check className="w-3.5 h-3.5" /> Check-in hecho
                            </span>
                        ) : s.canCheckIn ? (
                            <button
                                type="button"
                                onClick={() => checkIn(s.id)}
                                disabled={checkingIn != null}
                                className="px-4 py-2 rounded-lg bg-[#3ED6C4] text-[#0B1120] font-bold text-sm hover:bg-[#5EE8D8] disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                            >
                                {checkingIn === s.id && <Loader2 className="w-4 h-4 animate-spin" />}
                                Hacer check-in
                            </button>
                        ) : null}
                    </div>

                    {!s.checkedIn && s.status === 'in_progress' && (
                        <p className="text-xs text-[#E8B04B]">No hiciste check-in en esta sesión: no puedes ver el código de las partidas.</p>
                    )}
                    {!s.checkedIn && s.status === 'scheduled' && <p className="text-xs text-[#7C8AA6]">El check-in se abre antes de empezar.</p>}

                    {s.checkedIn && s.games.length > 0 && (
                        <div className="space-y-1.5">
                            {s.games.map((g) => (
                                <GameLine key={g.id} game={g} base={base} proofMode={proofMode} teamSize={teamSize} onReported={load} />
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {sessions && sessions.length > 0 && <PlayerAudit base={base} />}
        </section>
    );
}

function GameLine({
    game,
    base,
    proofMode,
    teamSize,
    onReported,
}: {
    game: MatchdayGame;
    base: string;
    proofMode: string;
    teamSize: number;
    onReported: () => void;
}) {
    const [show, setShow] = useState(false);
    const [copied, setCopied] = useState(false);

    const copy = () => {
        if (!game.code) return;
        navigator.clipboard.writeText(game.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="space-y-1.5">
        <div
            className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md ${
                game.code ? 'border border-[#3ED6C4]/50 bg-[#132A2A]' : 'bg-[#131B2E]'
            }`}
        >
            <span className="font-mono text-xs text-[#EDF0F7]">
                Partida {game.gameNumber} · <span className="text-[#7C8AA6]">{GAME_LABELS[game.status] || game.status}</span>
            </span>
            {game.code && (
                <span className="flex items-center gap-1.5">
                    <code className="font-mono text-sm px-2 py-0.5 rounded bg-[#0B1120] text-[#EDF0F7] tracking-wider">{show ? game.code : '••••••'}</code>
                    <button type="button" onClick={() => setShow((v) => !v)} className="p-1 text-[#7C8AA6] hover:text-[#3ED6C4]" title={show ? 'Ocultar' : 'Mostrar'}>
                        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button type="button" onClick={copy} className="p-1 text-[#7C8AA6] hover:text-[#3ED6C4]" title="Copiar">
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                    {copied && <span className="text-[10px] text-[#3ED6C4]">copiado</span>}
                </span>
            )}
        </div>
        {game.teamResult && (
            <p className="px-3 font-mono text-[11px] text-[#3ED6C4]">
                Resultado de tu equipo: {RESULT_LABELS[game.teamResult.status] || game.teamResult.status}
                {game.teamResult.status === 'approved' && ` · puesto ${game.teamResult.placement} · ${game.teamResult.eliminations} elim. · ${game.teamResult.points} pts`}
                {game.teamResult.source === 'staff' && ' (lo cargó el organizador, mira el historial)'}
            </p>
        )}
        {!game.teamResult && game.myReport && !game.canReport && (
            <p className="px-3 font-mono text-[11px] text-[#7C8AA6]">
                Tu reporte: puesto {game.myReport.placement} · {game.myReport.eliminations} elim. — esperando revisión del organizador.
            </p>
        )}
        {game.canReport && <ReportForm game={game} base={base} proofMode={proofMode} teamSize={teamSize} onReported={onReported} />}
        {!game.canReport && !game.teamResult && game.cannotReportReason && proofMode !== 'staff_only' && (
            <p className="px-3 text-[11px] text-[#7C8AA6]">{game.cannotReportReason}</p>
        )}
        </div>
    );
}

// Reporte del jugador: puesto de su equipo, SUS eliminaciones y la captura de la
// pantalla final. Se puede corregir hasta que el organizador lo revise.
function ReportForm({
    game,
    base,
    proofMode,
    teamSize,
    onReported,
}: {
    game: MatchdayGame;
    base: string;
    proofMode: string;
    teamSize: number;
    onReported: () => void;
}) {
    const [placement, setPlacement] = useState(game.myReport?.placement?.toString() ?? '');
    const [eliminations, setEliminations] = useState(game.myReport?.eliminations?.toString() ?? '0');
    const [file, setFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const screenshotRequired = proofMode === 'always' && !game.myReport?.hasScreenshot;
    const deadline = parseDate(game.deadline);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setDone(false);
        try {
            const form = new FormData();
            form.append('placement', placement);
            form.append('eliminations', eliminations || '0');
            if (file) form.append('screenshot', file);
            await api.post(`${base}/games/${game.id}/report`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setFile(null);
            setDone(true);
            onReported();
        } catch (err: any) {
            setError(err?.response?.data?.message || 'No se pudo enviar el reporte');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} className="p-3 rounded-md border border-[#232C42] bg-[#0B1120] space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#7C8AA6]">
                {game.myReport ? 'Tu reporte (puedes corregirlo)' : 'Reporta tu resultado'}
                {deadline && ` · hasta las ${deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
            </p>
            {game.needsScreenshot && (
                <p className="text-xs text-[#E8B04B] flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Hay algo raro en el resultado de tu equipo: sube tu captura.
                </p>
            )}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="font-mono text-[10px] uppercase tracking-wider text-[#7C8AA6]">{teamSize > 1 ? 'Puesto del equipo' : 'Puesto'}</label>
                    <input
                        type="number"
                        min={1}
                        max={100}
                        required
                        value={placement}
                        onChange={(e) => setPlacement(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#232C42] bg-[#0F1729] text-[#EDF0F7] text-sm"
                    />
                </div>
                <div>
                    <label className="font-mono text-[10px] uppercase tracking-wider text-[#7C8AA6]">{teamSize > 1 ? 'Tus eliminaciones' : 'Eliminaciones'}</label>
                    <input
                        type="number"
                        min={0}
                        max={99}
                        required
                        value={eliminations}
                        onChange={(e) => setEliminations(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg border border-[#232C42] bg-[#0F1729] text-[#EDF0F7] text-sm"
                    />
                </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs text-[#3ED6C4] font-bold cursor-pointer">
                    <Paperclip className="w-3.5 h-3.5" />
                    {file ? file.name : game.myReport?.hasScreenshot ? 'Cambiar captura' : `Captura de la pantalla final${screenshotRequired ? ' (obligatoria)' : ' (opcional)'}`}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
                {game.myReport?.screenshotFileId && !file && (
                    <AuthImage url={`${base}/files/${game.myReport.screenshotFileId}`} alt="Tu captura" className="w-14 h-9" />
                )}
            </div>
            {error && <p className="text-xs text-[#E8677A]">{error}</p>}
            {done && <p className="text-xs text-[#3ED6C4]">Reporte enviado.</p>}
            <button
                type="submit"
                disabled={saving || !placement || (screenshotRequired && !file)}
                className="w-full py-2 rounded-lg bg-[#3ED6C4] text-[#0B1120] font-bold text-sm hover:bg-[#5EE8D8] disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {game.myReport ? 'Guardar cambios' : 'Enviar reporte'}
            </button>
        </form>
    );
}

interface AuditEntry {
    id: number;
    createdAt: string;
    action: string;
    actorName: string;
    sessionName: string;
    gameNumber: number;
    teamName: string;
    before: { placement: number | null; eliminations: number; status: string } | null;
    after: { placement: number | null; eliminations: number; status: string } | null;
    reason: string | null;
    evidenceFileIds: number[];
}

function describe(r: AuditEntry['before']): string {
    if (!r) return '—';
    if (r.status !== 'approved') return RESULT_LABELS[r.status] || r.status;
    return `puesto ${r.placement} · ${r.eliminations} elim.`;
}

// Todo lo que hizo el organizador con los resultados, con su motivo y justificantes.
function PlayerAudit({ base }: { base: string }) {
    const [open, setOpen] = useState(false);
    const [entries, setEntries] = useState<AuditEntry[] | null>(null);

    useEffect(() => {
        if (!open) return;
        api.get(`${base}/audit`).then((res) => setEntries(res.data.entries || [])).catch(() => setEntries([]));
    }, [open, base]);

    return (
        <div className="rounded-lg border border-[#232C42]">
            <button type="button" onClick={() => setOpen((v) => !v)} className="w-full px-4 py-3 flex items-center justify-between gap-2">
                <span className="font-display font-bold text-sm flex items-center gap-2">
                    <History className="w-4 h-4 text-[#3ED6C4]" /> Cambios del organizador
                </span>
                {open ? <ChevronDown className="w-4 h-4 text-[#7C8AA6]" /> : <ChevronRight className="w-4 h-4 text-[#7C8AA6]" />}
            </button>
            {open && (
                <div className="px-4 pb-4 space-y-2">
                    {entries == null ? null : entries.length === 0 ? (
                        <p className="text-xs text-[#7C8AA6]">Todavía no hay cambios.</p>
                    ) : (
                        entries.map((e) => (
                            <div key={e.id} className="p-3 rounded-md bg-[#0F1729] space-y-1">
                                <p className="text-xs text-[#EDF0F7]">
                                    <span className="font-bold">{e.actorName}</span> {AUDIT_LABELS[e.action] || e.action} de <span className="font-bold">{e.teamName}</span>
                                </p>
                                <p className="font-mono text-[10px] text-[#7C8AA6]">
                                    {e.sessionName}, partida {e.gameNumber} · {formatDate(e.createdAt)}
                                </p>
                                {(e.before || e.after) && (
                                    <p className="font-mono text-[11px] text-[#EDF0F7]">
                                        {describe(e.before)} → {describe(e.after)}
                                    </p>
                                )}
                                {e.reason && <p className="text-[11px] italic text-[#7C8AA6]">“{e.reason}”</p>}
                                {e.evidenceFileIds.length > 0 && (
                                    <div className="flex gap-1.5 flex-wrap">
                                        {e.evidenceFileIds.map((id) => (
                                            <AuthImage key={id} url={`${base}/files/${id}`} alt="Justificante" className="w-16 h-10" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
