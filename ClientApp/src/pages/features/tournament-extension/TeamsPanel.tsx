import React, { useEffect, useState } from 'react';
import { UsersRound, Plus, Swords, Check, AlertTriangle, Loader2, Copy, ChevronsRight, ArrowUpRight } from 'lucide-react';
import api from '../../../services/api';
import { EditionPicker } from './shared';
import type { TournamentEdition } from './shared';
import BracketTree from '../../../components/tournament/BracketTree';

// Milestone 4 — equipos (ARAM N vs N, Clash 5v5) + bracket. Cierre de Milestone 4:
// los 4 formatos de .dev/torneos/02-motor-de-torneo-formatos.md seccion 5 ya estan
// implementados en el backend (single_elimination, round_robin, double_elimination,
// swiss) — ver Decatron.Services/Tournament/BracketGenerators/. Este panel renderiza
// cada uno distinto: single/double elim como arbol real (components/tournament/
// BracketTree, compartido con la pagina publica), round_robin y swiss como tabla de
// posiciones + jornadas/rondas.

interface Participant {
    id: number;
    displayName: string;
    status: string;
    teamId: number | null;
}

interface TeamRosterMember {
    id: number;
    displayName: string;
    isCaptain: boolean;
    isSubstitute: boolean;
}

interface Team {
    id: number;
    name: string;
    seed: number | null;
    joinCode: string | null;
    roster: TeamRosterMember[];
    startersCount: number;
}

interface Match {
    id: number;
    roundNumber: number;
    bracketPosition: number;
    bracketSide: 'winners' | 'losers' | 'grand_final' | null;
    status: string;
    teamAId: number | null;
    teamAName: string | null;
    teamBId: number | null;
    teamBName: string | null;
    winnerTeamId: number | null;
}

interface Standing {
    teamId: number;
    teamName: string | null;
    wins: number;
    losses: number;
    rank: number;
}

const MATCH_STATUS_LABELS: Record<string, string> = {
    scheduled: 'Pendiente',
    in_progress: 'En curso',
    finished: 'Jugado',
    walkover: 'Bye',
};

const BRACKET_FORMAT_LABELS: Record<string, string> = {
    single_elimination: 'Eliminación simple',
    double_elimination: 'Doble eliminación',
    round_robin: 'Todos contra todos',
    swiss: 'Suizo',
};

export default function TeamsPanel({
    edition,
    editions,
    onSelectEdition,
}: {
    edition: TournamentEdition | null;
    editions: TournamentEdition[];
    onSelectEdition: (id: number) => void;
}) {
    const [teams, setTeams] = useState<Team[]>([]);
    const [teamSize, setTeamSize] = useState<number | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [seeding, setSeeding] = useState(false);
    const [generatingRound, setGeneratingRound] = useState(false);

    // `load` se usa tanto para la carga inicial (con spinner de pagina completa) como
    // para refrescar despues de una accion (cargar resultado, generar bracket, etc.)
    // — para esa segunda situacion NO queremos tapar todo el contenido con
    // "Cargando...", se siente como que recargo la pagina entera por un solo click.
    // `showSpinner` controla eso: solo la carga inicial lo pide.
    const load = async (editionId: number, showSpinner = false) => {
        if (showSpinner) setLoading(true);
        try {
            const [teamsRes, partsRes, bracketRes] = await Promise.all([
                api.get(`/admin/tournament/editions/${editionId}/teams`),
                api.get(`/admin/tournament/editions/${editionId}/participants`),
                api.get(`/admin/tournament/editions/${editionId}/bracket`),
            ]);
            setTeams(teamsRes.data.teams || []);
            setTeamSize(teamsRes.data.teamSize);
            setParticipants(partsRes.data.participants || []);
            setMatches(bracketRes.data.matches || []);
            setStandings(bracketRes.data.standings || []);
        } catch (err) {
            console.error('Error cargando equipos', err);
        } finally {
            if (showSpinner) setLoading(false);
        }
    };

    useEffect(() => {
        if (edition) load(edition.id, true);
    }, [edition?.id]);

    if (!edition) return <EditionPicker editions={editions} onSelectEdition={onSelectEdition} />;

    if (!edition.mode || edition.mode === 'solo_q_climb') {
        return (
            <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">
                Esta sección solo aplica a ediciones en modo ARAM N vs N o Grieta 5v5 — {edition.name} es SoloQ Climb.
            </p>
        );
    }

    const handleCreateTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post(`/admin/tournament/editions/${edition.id}/teams`, { name: newTeamName });
            setNewTeamName('');
            setShowForm(false);
            await load(edition.id);
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'Error creando el equipo' });
        }
    };

    const TEST_TEAM_NAMES = ['Vanguardia', 'Los Invictos', 'Fenix Gaming'];

    const handleSeedTeams = async () => {
        setSeeding(true);
        setMessage(null);
        try {
            for (const name of TEST_TEAM_NAMES) {
                await api.post(`/admin/tournament/editions/${edition.id}/teams`, { name });
            }
            setMessage({
                ok: true,
                text: `${TEST_TEAM_NAMES.length} equipos de prueba creados — quedan sin miembros, sumales participantes antes de generar el bracket.`,
            });
            await load(edition.id);
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'Error creando equipos de prueba' });
        } finally {
            setSeeding(false);
        }
    };

    const handleAddMember = async (teamId: number, participantId: number, isSubstitute: boolean) => {
        try {
            await api.post(`/admin/tournament/editions/${edition.id}/teams/${teamId}/members`, { participantId, isSubstitute });
            await load(edition.id);
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'Error agregando al equipo' });
        }
    };

    const isClash = edition.mode === 'clash_5v5';

    const handleGenerateBracket = async () => {
        setMessage(null);
        try {
            const res = await api.post(`/admin/tournament/editions/${edition.id}/bracket/generate`);
            const extra =
                res.data.leftOverParticipants > 0
                    ? ` (${res.data.leftOverParticipants} participante(s) quedaron sin equipo, no alcanzaban para completar uno más)`
                    : '';
            setMessage({ ok: true, text: `Bracket generado — ${res.data.matchesCreated} matches${extra}` });
            await load(edition.id);
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'Error generando el bracket' });
        }
    };

    const handleRecordResult = async (matchId: number, winnerTeamId: number) => {
        try {
            await api.post(`/admin/tournament/bracket/matches/${matchId}/result`, { winnerTeamId });
            await load(edition.id);
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'Error cargando el resultado' });
        }
    };

    const handleGenerateNextRound = async () => {
        setGeneratingRound(true);
        setMessage(null);
        try {
            const res = await api.post(`/admin/tournament/editions/${edition.id}/bracket/next-round`);
            setMessage({ ok: true, text: `Ronda siguiente generada — ${res.data.matchesCreated} match(es)` });
            await load(edition.id);
        } catch (err: any) {
            setMessage({ ok: false, text: err?.response?.data?.message || 'Error generando la ronda siguiente' });
        } finally {
            setGeneratingRound(false);
        }
    };

    const unassigned = participants.filter((p) => p.status === 'approved' && !p.teamId);
    const bracketFormat = edition.bracketFormat || 'single_elimination';
    const currentRound = matches.length > 0 ? Math.max(...matches.map((m) => m.roundNumber)) : 0;
    const currentRoundComplete =
        matches.length > 0 && matches.filter((m) => m.roundNumber === currentRound).every((m) => m.status === 'finished' || m.status === 'walkover');

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg 4xl:text-xl font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-2">
                    <UsersRound className="w-5 h-5 text-[#2563eb]" /> Equipos — {edition.name}
                </h2>
                {isClash && (
                    <div className="flex items-center gap-2">
                        {teams.length === 0 && (
                            <button
                                type="button"
                                onClick={handleSeedTeams}
                                disabled={seeding}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] text-sm font-bold hover:bg-[#e2e8f0] dark:hover:bg-[#374151] disabled:opacity-50"
                            >
                                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Crear equipos de prueba
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowForm((v) => !v)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb]"
                        >
                            <Plus className="w-4 h-4" /> Nuevo equipo
                        </button>
                    </div>
                )}
            </div>

            {message && (
                <p className={`text-sm flex items-center gap-1 ${message.ok ? 'text-[#2563eb]' : 'text-red-600 dark:text-red-400'}`}>
                    {message.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {message.text}
                </p>
            )}

            {!isClash && (
                <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                    En ARAM N vs N los equipos no se arman a mano: cada participante se anota individualmente (pestaña Participantes) y el sistema sortea
                    equipos de {teamSize} al generar el bracket.
                </p>
            )}

            {isClash && showForm && (
                <form onSubmit={handleCreateTeam} className="p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151] flex items-center gap-2">
                    <input
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        required
                        placeholder="Nombre del equipo"
                        className="flex-1 px-3 py-2 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-sm"
                    />
                    <button type="submit" className="px-4 py-2 rounded-lg bg-[#16a34a] text-white text-sm font-bold hover:bg-[#15803d]">
                        Crear
                    </button>
                </form>
            )}

            {loading ? (
                <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">Cargando...</p>
            ) : (
                <>
                    {isClash &&
                        (teams.length === 0 ? (
                            <p className="text-sm 4xl:text-base text-[#64748b] dark:text-[#94a3b8]">
                                Sin equipos todavía. Cada equipo necesita {teamSize} titular(es) — los suplentes son opcionales.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {teams.map((t) => (
                                    <TeamCard key={t.id} team={t} teamSize={teamSize} unassigned={unassigned} onAddMember={handleAddMember} />
                                ))}
                            </div>
                        ))}
                    {/* ARAM: los equipos se sortean solos al generar el bracket y ya se ven ahi
                        mismo con nombre — mostrar de nuevo la grilla acá (a veces 20+ tarjetas)
                        solo alarga la pagina sin sumar informacion nueva. */}

                    <div className="pt-4 border-t border-[#e2e8f0] dark:border-[#374151]">
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <h3 className="text-sm font-bold text-[#1e293b] dark:text-[#f8fafc] flex items-center gap-1.5 font-mono">
                                <Swords className="w-4 h-4 text-[#2563eb]" />
                                Bracket ({edition.mode === 'aram_teams' ? 'ARAM N vs N' : 'Grieta 5v5'}) —{' '}
                                {BRACKET_FORMAT_LABELS[bracketFormat] || bracketFormat}
                            </h3>
                            {matches.length === 0 && (
                                <button
                                    type="button"
                                    onClick={handleGenerateBracket}
                                    disabled={isClash ? teams.length < 2 : participants.filter((p) => p.status === 'approved').length < (teamSize || 1) * 2}
                                    className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50"
                                >
                                    Generar bracket{!isClash ? ' (sortea equipos)' : ''}
                                </button>
                            )}
                            {matches.length > 0 && bracketFormat === 'swiss' && (
                                <button
                                    type="button"
                                    onClick={handleGenerateNextRound}
                                    disabled={generatingRound || !currentRoundComplete}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white text-sm font-bold hover:from-[#1d4ed8] hover:to-[#2563eb] disabled:opacity-50"
                                    title={!currentRoundComplete ? `Todavía hay matches sin resultado en la ronda ${currentRound}` : undefined}
                                >
                                    {generatingRound ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronsRight className="w-4 h-4" />}
                                    Generar próxima ronda
                                </button>
                            )}
                        </div>

                        {matches.length === 0 ? (
                            <p className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                                Sin bracket generado todavía. Necesitás al menos 2 equipos.
                            </p>
                        ) : bracketFormat === 'round_robin' || bracketFormat === 'swiss' ? (
                            <div className="space-y-6">
                                <StandingsTable standings={standings} />
                                <div className="space-y-4 4xl:space-y-6">
                                    {Array.from(new Set(matches.map((m) => m.roundNumber)))
                                        .sort((a, b) => a - b)
                                        .map((round) => (
                                            <div key={round}>
                                                <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-1.5 font-mono">
                                                    {bracketFormat === 'round_robin' ? `Jornada ${round}` : `Ronda ${round}`}
                                                </p>
                                                <div className="space-y-1.5">
                                                    {matches
                                                        .filter((m) => m.roundNumber === round)
                                                        .map((m) => (
                                                            <MatchRow key={m.id} match={m} onRecordResult={handleRecordResult} />
                                                        ))}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ) : bracketFormat === 'double_elimination' ? (
                            <div className="space-y-8">
                                <div>
                                    <p className="text-xs font-bold text-[#2563eb] mb-2 font-mono uppercase tracking-wide">Winners</p>
                                    <BracketTree
                                        matches={toBracketNodes(matches.filter((m) => m.bracketSide === 'winners'))}
                                        onRecordResult={(id, winnerId) => handleRecordResult(id as number, winnerId)}
                                    />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-[#64748b] dark:text-[#94a3b8] mb-2 font-mono uppercase tracking-wide">Losers</p>
                                    <BracketTree
                                        matches={toBracketNodes(matches.filter((m) => m.bracketSide === 'losers'))}
                                        onRecordResult={(id, winnerId) => handleRecordResult(id as number, winnerId)}
                                        finalLabel="Final del losers"
                                    />
                                </div>
                                {matches.some((m) => m.bracketSide === 'grand_final') && (
                                    <div>
                                        <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-2 font-mono uppercase tracking-wide flex items-center gap-1">
                                            <ArrowUpRight className="w-3.5 h-3.5" /> Gran final
                                        </p>
                                        <div className="space-y-1.5 max-w-md">
                                            {matches
                                                .filter((m) => m.bracketSide === 'grand_final')
                                                .sort((a, b) => a.roundNumber - b.roundNumber)
                                                .map((m) => (
                                                    <MatchRow key={m.id} match={m} onRecordResult={handleRecordResult} />
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <BracketTree matches={toBracketNodes(matches)} onRecordResult={(id, winnerId) => handleRecordResult(id as number, winnerId)} />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function StandingsTable({ standings }: { standings: Standing[] }) {
    if (standings.length === 0) return null;
    return (
        <div className="rounded-xl border border-[#e2e8f0] dark:border-[#374151] overflow-hidden">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] text-xs font-mono uppercase">
                        <th className="text-left px-3 py-2">#</th>
                        <th className="text-left px-3 py-2">Equipo</th>
                        <th className="text-right px-3 py-2">V</th>
                        <th className="text-right px-3 py-2">D</th>
                    </tr>
                </thead>
                <tbody>
                    {standings.map((s) => (
                        <tr key={s.teamId} className="border-t border-[#e2e8f0] dark:border-[#374151]">
                            <td
                                className={`px-3 py-2 font-mono ${s.rank === 1 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-[#64748b] dark:text-[#94a3b8]'}`}
                            >
                                {s.rank}
                            </td>
                            <td className="px-3 py-2 text-[#1e293b] dark:text-[#f8fafc] font-bold">{s.teamName || `Equipo ${s.teamId}`}</td>
                            <td className="px-3 py-2 text-right text-[#2563eb] font-mono">{s.wins}</td>
                            <td className="px-3 py-2 text-right text-red-600 dark:text-red-400 font-mono">{s.losses}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function toBracketNodes(matches: Match[]) {
    return matches.map((m) => ({
        id: m.id,
        roundNumber: m.roundNumber,
        bracketPosition: m.bracketPosition,
        teamAId: m.teamAId,
        teamAName: m.teamAName,
        teamBId: m.teamBId,
        teamBName: m.teamBName,
        winnerId: m.winnerTeamId,
        status: m.status,
    }));
}

function TeamCard({
    team,
    teamSize,
    unassigned,
    onAddMember,
}: {
    team: Team;
    teamSize: number | null;
    unassigned: Participant[];
    onAddMember: (teamId: number, participantId: number, isSubstitute: boolean) => void;
}) {
    const [selected, setSelected] = useState<number | ''>('');
    const complete = teamSize != null && team.startersCount >= teamSize;

    return (
        <div className="p-4 4xl:p-6 rounded-xl border border-[#e2e8f0] dark:border-[#374151]">
            <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#1e293b] dark:text-[#f8fafc]">{team.name}</span>
                <span
                    className={`text-xs px-2 py-0.5 rounded-full ${complete ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400' : 'bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]'}`}
                >
                    {team.startersCount}/{teamSize} titulares
                </span>
            </div>
            {team.joinCode && (
                <div className="flex items-center gap-1 mb-2">
                    <code className="text-[10px] px-1.5 py-0.5 rounded bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8]">{team.joinCode}</code>
                    <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(team.joinCode!)}
                        className="text-[#64748b] dark:text-[#94a3b8] hover:text-[#2563eb]"
                    >
                        <Copy className="w-3 h-3" />
                    </button>
                </div>
            )}
            <div className="space-y-1 mb-2">
                {team.roster.map((m) => (
                    <div key={m.id} className="text-xs 4xl:text-sm text-[#64748b] dark:text-[#94a3b8]">
                        {m.displayName} {m.isCaptain && <span className="text-[#2563eb] font-bold">(C)</span>}{' '}
                        {m.isSubstitute && <span className="italic">suplente</span>}
                    </div>
                ))}
                {team.roster.length === 0 && <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Sin miembros todavía.</p>}
            </div>
            {unassigned.length > 0 && (
                <div className="flex items-center gap-1.5">
                    <select
                        value={selected}
                        onChange={(e) => setSelected(Number(e.target.value) || '')}
                        className="flex-1 px-2 py-1 rounded-lg border border-[#e2e8f0] dark:border-[#374151] bg-[#f8fafc] dark:bg-[#262626] text-[#1e293b] dark:text-[#f8fafc] text-xs"
                    >
                        <option value="">Agregar participante...</option>
                        {unassigned.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.displayName}
                            </option>
                        ))}
                    </select>
                    <button
                        type="button"
                        disabled={!selected}
                        onClick={() => {
                            onAddMember(team.id, selected as number, false);
                            setSelected('');
                        }}
                        className="text-[10px] px-2 py-1 rounded bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white font-bold disabled:opacity-50"
                    >
                        Titular
                    </button>
                    <button
                        type="button"
                        disabled={!selected}
                        onClick={() => {
                            onAddMember(team.id, selected as number, true);
                            setSelected('');
                        }}
                        className="text-[10px] px-2 py-1 rounded bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] font-bold disabled:opacity-50"
                    >
                        Suplente
                    </button>
                </div>
            )}
        </div>
    );
}

function MatchRow({ match, onRecordResult }: { match: Match; onRecordResult: (matchId: number, winnerTeamId: number) => void }) {
    const canRecord = match.status === 'scheduled' && match.teamAId && match.teamBId;
    return (
        <div className="p-2.5 rounded-lg border border-[#e2e8f0] dark:border-[#374151] flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
                <span className={match.winnerTeamId === match.teamAId ? 'font-bold text-[#2563eb]' : 'text-[#1e293b] dark:text-[#f8fafc]'}>
                    {match.teamAName || 'TBD'}
                </span>
                <span className="text-[#64748b] dark:text-[#94a3b8] text-xs">vs</span>
                <span className={match.winnerTeamId === match.teamBId ? 'font-bold text-[#2563eb]' : 'text-[#1e293b] dark:text-[#f8fafc]'}>
                    {match.teamBName || (match.status === 'walkover' ? '(bye)' : 'TBD')}
                </span>
            </div>
            {canRecord ? (
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onRecordResult(match.id, match.teamAId!)}
                        className="text-[10px] px-2 py-1 rounded bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                    >
                        Ganó {match.teamAName}
                    </button>
                    <button
                        type="button"
                        onClick={() => onRecordResult(match.id, match.teamBId!)}
                        className="text-[10px] px-2 py-1 rounded bg-[#f8fafc] dark:bg-[#262626] text-[#64748b] dark:text-[#94a3b8] hover:bg-[#e2e8f0] dark:hover:bg-[#374151]"
                    >
                        Ganó {match.teamBName}
                    </button>
                </div>
            ) : (
                <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">{MATCH_STATUS_LABELS[match.status] || match.status}</span>
            )}
        </div>
    );
}
