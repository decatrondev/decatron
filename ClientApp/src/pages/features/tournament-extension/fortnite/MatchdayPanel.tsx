import React, { useEffect, useRef, useState } from 'react';
import { Radio, Loader2, AlertTriangle, Check, Eye, EyeOff, Save, Send, Play, Flag, Lock, RotateCcw, UserCheck, UserX, ClipboardCheck } from 'lucide-react';
import api from '../../../../services/api';
import { EditionPicker } from '../shared';
import type { TournamentEdition } from '../shared';
import type { FortniteSession } from './types';
import { SESSION_STATUS_LABELS, inputClass, labelClass, cardClass, primaryButton, secondaryButton } from './types';
import ResultsReview from './ResultsReview';
import AuditList from './AuditList';

// Pestaña "Día de partida" de Fortnite (.dev/torneos/15-fortnite.md F3): abrir el
// check-in de una sesion, ver quien lo hizo (y marcarlo a mano), poner el codigo de
// cada partida personalizada, revelarlo (solo lo ven los jugadores con check-in) y
// avanzar el estado de cada partida. El codigo va oculto por defecto: este panel
// puede estar en pantalla mientras el streamer transmite.

interface MatchdayPlayer {
    id: number;
    displayName: string;
    gameAccountName: string | null;
    teamId: number | null;
    teamName: string | null;
    checkedIn: boolean;
    checkedInBy: string | null;
}

interface MatchdayGame {
    id: number;
    gameNumber: number;
    status: string;
    customCode: string | null;
}

interface Matchday {
    session: { id: number; name: string; status: string; scheduledAt: string | null; groupId: number | null };
    players: MatchdayPlayer[];
    games: MatchdayGame[];
}

export const GAME_STATUS_LABELS: Record<string, string> = {
    waiting: 'Esperando',
    revealed: 'Código revelado',
    playing: 'En juego',
    reporting: 'Reportando resultados',
    closed: 'Cerrada',
};

const SESSION_ACTIONS: Record<string, { to: string; label: string; primary?: boolean }[]> = {
    scheduled: [{ to: 'check_in', label: 'Abrir check-in', primary: true }],
    check_in: [
        { to: 'in_progress', label: 'Cerrar check-in y empezar', primary: true },
        { to: 'scheduled', label: 'Volver a programada' },
    ],
    in_progress: [
        { to: 'finished', label: 'Terminar sesión', primary: true },
        { to: 'check_in', label: 'Reabrir check-in' },
    ],
    finished: [{ to: 'in_progress', label: 'Reabrir sesión' }],
};

export default function MatchdayPanel({
    edition,
    editions,
    onSelectEdition,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
}) {
    const [sessions, setSessions] = useState<FortniteSession[] | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);

    useEffect(() => {
        setSessions(null);
        setSessionId(null);
        if (!edition) return;
        api.get(`/admin/tournament/editions/${edition.id}/fortnite`)
            .then((res) => {
                const list: FortniteSession[] = res.data.sessions || [];
                setSessions(list);
                // Por defecto, la primera sesion que no termino.
                setSessionId((list.find((s) => s.status !== 'finished') || list[0])?.id ?? null);
            })
            .catch(() => setSessions([]));
    }, [edition?.id]);

    if (!edition) return <EditionPicker editions={editions} onSelectEdition={onSelectEdition} />;
    if (sessions == null) return <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />;

    return (
        <div className="space-y-4 4xl:space-y-6">
            <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                <Radio className="w-5 h-5 text-[#2563eb]" /> Día de partida — {edition.name}
            </h2>
            {sessions.length === 0 ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Primero crea una sesión en la pestaña Formato.</p>
            ) : (
                <>
                    <div className="flex gap-2 flex-wrap">
                        {sessions.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setSessionId(s.id)}
                                className={`px-3 py-2 4xl:px-4 4xl:py-2.5 rounded-lg text-sm 4xl:text-base font-bold ${
                                    s.id === sessionId
                                        ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white'
                                        : 'bg-[#f8fafc] dark:bg-[#262626] text-[#475569] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]'
                                }`}
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                    {sessionId != null && <SessionMatchday key={sessionId} editionId={edition.id} sessionId={sessionId} />}
                </>
            )}
        </div>
    );
}

function SessionMatchday({ editionId, sessionId }: { editionId: number; sessionId: number }) {
    const [data, setData] = useState<Matchday | null>(null);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [announce, setAnnounce] = useState(true);
    const [sendDm, setSendDm] = useState(true);
    const base = `/admin/tournament/editions/${editionId}/fortnite`;

    const load = async () => {
        try {
            const res = await api.get(`${base}/sessions/${sessionId}/matchday`);
            setData(res.data);
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'Error cargando la sesión' });
        }
    };

    // Refresco cada 10 s para ver los check-in que van llegando.
    useEffect(() => {
        load();
        const t = setInterval(load, 10000);
        return () => clearInterval(t);
    }, [sessionId]);

    const run = async (key: string, fn: () => Promise<string | void>) => {
        setBusy(key);
        setMessage(null);
        try {
            const text = await fn();
            if (text) setMessage({ ok: true, text });
            await load();
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'No se pudo completar la acción' });
        } finally {
            setBusy(null);
        }
    };

    if (!data) return <Loader2 className="w-6 h-6 animate-spin text-[#2563eb]" />;

    const { session, players, games } = data;
    const checkedCount = players.filter((p) => p.checkedIn).length;

    // Agrupa por equipo para leer rapido quien falta.
    const byTeam = new Map<string, MatchdayPlayer[]>();
    players.forEach((p) => {
        const key = p.teamName || 'Sin equipo';
        byTeam.set(key, [...(byTeam.get(key) || []), p]);
    });

    return (
        <div className="space-y-4 4xl:space-y-6">
            {/* Estado de la sesion */}
            <section className={cardClass}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">{session.name}</p>
                        <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                            {SESSION_STATUS_LABELS[session.status] || session.status} · {checkedCount}/{players.length} con check-in
                        </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {(SESSION_ACTIONS[session.status] || []).map((a) => (
                            <button
                                key={a.to}
                                type="button"
                                disabled={busy != null}
                                onClick={() => run(`status-${a.to}`, async () => void (await api.post(`${base}/sessions/${sessionId}/status`, { status: a.to })))}
                                className={a.primary ? primaryButton : secondaryButton}
                            >
                                {busy === `status-${a.to}` && <Loader2 className="w-4 h-4 animate-spin" />}
                                {a.label}
                            </button>
                        ))}
                    </div>
                </div>
                {message && (
                    <p className={`text-sm 4xl:text-base flex items-center gap-1 ${message.ok ? 'text-[#16a34a]' : 'text-red-600 dark:text-red-400'}`}>
                        {message.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {message.text}
                    </p>
                )}
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-4 4xl:gap-6 items-start">
                {/* Check-in */}
                <section className={cardClass}>
                    <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">Check-in</h3>
                    <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                        Solo quienes hicieron check-in ven el código de la partida. Puedes marcarlo tú si alguien no puede.
                    </p>
                    {players.length === 0 ? (
                        <p className="text-sm text-[#64748b] dark:text-[#94a3b8]">Nadie juega esta sesión todavía (¿faltan equipos o grupos?).</p>
                    ) : (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                            {Array.from(byTeam.entries()).map(([team, list]) => (
                                <div key={team} className="space-y-1">
                                    <p className="text-[11px] 4xl:text-xs font-bold uppercase font-mono text-[#64748b] dark:text-[#94a3b8]">{team}</p>
                                    {list.map((p) => (
                                        <div key={p.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#f8fafc] dark:bg-[#262626]">
                                            <div className="min-w-0">
                                                <p className="text-sm 4xl:text-base text-[#1e293b] dark:text-[#f8fafc] truncate">{p.displayName}</p>
                                                {p.gameAccountName && <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8] truncate">Epic: {p.gameAccountName}</p>}
                                            </div>
                                            <button
                                                type="button"
                                                disabled={busy != null}
                                                title={p.checkedIn ? 'Quitar check-in' : 'Marcar check-in'}
                                                onClick={() =>
                                                    run(`ci-${p.id}`, async () => void (await api.post(`${base}/sessions/${sessionId}/checkins/${p.id}`, { checkedIn: !p.checkedIn })))
                                                }
                                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold flex-shrink-0 ${
                                                    p.checkedIn
                                                        ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
                                                        : 'bg-white dark:bg-[#1B1C1D] text-[#64748b] dark:text-[#94a3b8] border border-[#e2e8f0] dark:border-[#374151]'
                                                }`}
                                            >
                                                {p.checkedIn ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                                                {p.checkedIn ? (p.checkedInBy === 'staff' ? 'Check-in (tú)' : 'Check-in') : 'Sin check-in'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Partidas */}
                <section className={cardClass}>
                    <h3 className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">Partidas</h3>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm 4xl:text-base text-[#1e293b] dark:text-[#f8fafc]">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
                            Avisar en el chat al revelar (sin el código)
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={sendDm} onChange={(e) => setSendDm(e.target.checked)} />
                            Mandar el código por DM de Discord
                        </label>
                    </div>
                    <div className="space-y-2">
                        {games.map((g, i) => (
                            <GameRow
                                key={g.id}
                                game={g}
                                previousCode={games.slice(0, i).reverse().find((x) => x.customCode)?.customCode || ''}
                                base={base}
                                busy={busy}
                                run={run}
                                announce={announce}
                                sendDm={sendDm}
                                reload={load}
                            />
                        ))}
                    </div>
                </section>
            </div>

            <AuditList base={base} />
        </div>
    );
}

function GameRow({
    game,
    previousCode,
    base,
    busy,
    run,
    announce,
    sendDm,
    reload,
}: {
    game: MatchdayGame;
    previousCode: string;
    base: string;
    busy: string | null;
    run: (key: string, fn: () => Promise<string | void>) => Promise<void>;
    announce: boolean;
    sendDm: boolean;
    reload: () => void;
}) {
    // Si la partida no tiene codigo, se sugiere el de la anterior (suele repetirse).
    const [code, setCode] = useState(game.customCode ?? previousCode);
    const [showCode, setShowCode] = useState(false);
    const played = game.status === 'playing' || game.status === 'reporting' || game.status === 'closed';
    // La revision se abre sola cuando la partida pasa a "reportando".
    const [showResults, setShowResults] = useState(game.status === 'reporting');
    const lastServerCode = useRef(game.customCode);

    useEffect(() => {
        if (game.customCode !== lastServerCode.current) {
            lastServerCode.current = game.customCode;
            setCode(game.customCode ?? previousCode);
        }
    }, [game.customCode]);

    const ended = game.status === 'reporting' || game.status === 'closed';
    const dirty = code.trim() !== (game.customCode ?? '');

    const setStatus = (to: string) => run(`g-${game.id}`, async () => void (await api.post(`${base}/games/${game.id}/status`, { status: to })));

    const saveCode = () => run(`g-${game.id}`, async () => void (await api.put(`${base}/games/${game.id}/code`, { code })));

    const reveal = () =>
        run(`g-${game.id}`, async () => {
            if (dirty) await api.put(`${base}/games/${game.id}/code`, { code });
            const res = await api.post(`${base}/games/${game.id}/reveal`, { announceInChat: announce, sendDiscordDm: sendDm });
            const r = res.data.result;
            const parts = [`Partida ${game.gameNumber}: código revelado.`];
            if (r.chatAnnounced) parts.push('Aviso enviado al chat.');
            if (sendDm) parts.push(`${r.discordDmsQueued} DM(s) de Discord en camino.`);
            return parts.join(' ');
        });

    return (
        <div className="p-3 4xl:p-4 rounded-lg border border-[#e2e8f0] dark:border-[#374151] space-y-2">
            <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-[#1e293b] dark:text-[#f8fafc] 4xl:text-lg">Partida {game.gameNumber}</p>
                <span className="text-xs 4xl:text-sm px-2 py-0.5 rounded-full bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]">
                    {GAME_STATUS_LABELS[game.status] || game.status}
                </span>
            </div>
            {!ended && (
                <div>
                    <label className={labelClass}>Código de la partida personalizada</label>
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            type={showCode ? 'text' : 'password'}
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            maxLength={60}
                            autoComplete="off"
                            className={inputClass + ' mt-0 font-mono'}
                            placeholder="Código"
                        />
                        <button
                            type="button"
                            onClick={() => setShowCode((v) => !v)}
                            title={showCode ? 'Ocultar' : 'Mostrar'}
                            className="p-2 rounded-lg text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb] flex-shrink-0"
                        >
                            {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        {dirty && code.trim() && game.status !== 'waiting' && (
                            <button type="button" disabled={busy != null} onClick={saveCode} className={secondaryButton} title="Guardar código">
                                <Save className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {dirty && game.status !== 'waiting' && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                            Cambiaste el código de una partida ya revelada: guárdalo y vuelve a revelarlo para avisar de nuevo.
                        </p>
                    )}
                </div>
            )}
            <div className="flex gap-2 flex-wrap">
                {(game.status === 'waiting' || (game.status === 'revealed' && dirty)) && (
                    <button type="button" disabled={busy != null || !code.trim()} onClick={reveal} className={primaryButton}>
                        {busy === `g-${game.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Revelar código
                    </button>
                )}
                {game.status === 'revealed' && !dirty && (
                    <>
                        <button type="button" disabled={busy != null} onClick={reveal} className={secondaryButton} title="Vuelve a avisar en el chat y por DM">
                            <Send className="w-4 h-4" /> Avisar de nuevo
                        </button>
                        <button type="button" disabled={busy != null} onClick={() => setStatus('playing')} className={primaryButton}>
                            <Play className="w-4 h-4" /> Empezó
                        </button>
                    </>
                )}
                {game.status === 'playing' && (
                    <button type="button" disabled={busy != null} onClick={() => setStatus('reporting')} className={primaryButton}>
                        <Flag className="w-4 h-4" /> Terminó
                    </button>
                )}
                {game.status === 'reporting' && (
                    <button type="button" disabled={busy != null} onClick={() => setStatus('closed')} className={primaryButton}>
                        <Lock className="w-4 h-4" /> Cerrar partida
                    </button>
                )}
                {played && (
                    <button type="button" onClick={() => setShowResults((v) => !v)} className={secondaryButton}>
                        <ClipboardCheck className="w-4 h-4" /> {showResults ? 'Ocultar resultados' : 'Resultados'}
                    </button>
                )}
                {game.status !== 'waiting' && (
                    <button
                        type="button"
                        disabled={busy != null}
                        onClick={() => {
                            const back = game.status === 'closed' ? 'reporting' : game.status === 'reporting' ? 'playing' : game.status === 'playing' ? 'revealed' : 'waiting';
                            setStatus(back);
                        }}
                        className={secondaryButton}
                        title="Deshacer el último paso"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                )}
            </div>
            {played && showResults && <ResultsReview base={base} gameId={game.id} onChanged={reload} />}
        </div>
    );
}
