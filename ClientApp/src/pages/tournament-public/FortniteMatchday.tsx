import { useEffect, useState } from 'react';
import { Loader2, Check, Copy, Eye, EyeOff, CalendarDays } from 'lucide-react';
import api from '../../services/api';

// "Día de partida" del jugador de Fortnite (.dev/torneos/15-fortnite.md F3): sus
// sesiones, el boton de check-in y el codigo de la partida personalizada cuando el
// organizador lo revela. El codigo solo llega si hizo check-in; va oculto por
// defecto porque el jugador puede estar transmitiendo.

interface MatchdayGame {
    gameNumber: number;
    status: string;
    code: string | null;
}

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
    reporting: 'Terminada',
    closed: 'Cerrada',
};

function formatDate(iso: string | null): string {
    if (!iso) return 'Sin fecha';
    return new Date(iso.endsWith('Z') ? iso : iso + 'Z').toLocaleString();
}

export default function FortniteMatchday({ channelName, editionSlug }: { channelName: string; editionSlug: string }) {
    const [sessions, setSessions] = useState<MatchdaySession[] | null>(null);
    const [error, setError] = useState('');
    const [checkingIn, setCheckingIn] = useState<number | null>(null);

    const load = async () => {
        try {
            const res = await api.get(`/me/tournament/${channelName}/${editionSlug}/matchday`);
            setSessions(res.data.sessions || []);
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
                                <GameLine key={g.gameNumber} game={g} />
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </section>
    );
}

function GameLine({ game }: { game: MatchdayGame }) {
    const [show, setShow] = useState(false);
    const [copied, setCopied] = useState(false);

    const copy = () => {
        if (!game.code) return;
        navigator.clipboard.writeText(game.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
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
    );
}
