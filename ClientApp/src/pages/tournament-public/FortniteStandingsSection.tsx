import { useEffect, useState } from 'react';
import { Crown, Flame, ChevronDown, ChevronRight, ArrowUpRight } from 'lucide-react';
import api from '../../services/api';
import { SectionLabel, EmptyState } from './shared';

// Clasificación pública de Fortnite (.dev/torneos/15-fortnite.md F5): una tabla por
// ámbito (lobby único, cada grupo, final), con match point, clasificados y el
// detalle partida por partida de cada equipo. Se refresca sola mientras el torneo
// está en juego.

interface Row {
    rank: number;
    teamId: number;
    teamName: string;
    members: string[];
    points: number;
    gamesPlayed: number;
    wins: number;
    eliminations: number;
    avgPlacement: number | null;
    matchPoint: boolean;
    champion: boolean;
    qualifies: boolean;
}

interface Scope {
    key: string;
    name: string;
    isFinal: boolean;
    qualifyCount: number | null;
    gamesPlanned: number;
    gamesWithResults: number;
    usesMatchPoint: boolean;
    rows: Row[];
}

interface Rules {
    placementPoints: { from: number; to: number; points: number }[];
    pointsPerElimination: number;
    tiebreakers: string[];
    matchPointThreshold: number | null;
    publicScreenshots: boolean;
}

interface TeamGame {
    sessionName: string;
    gameNumber: number;
    status: string;
    placement: number | null;
    eliminations: number;
    points: number;
    screenshotFileIds: number[];
}

const TIEBREAKERS: Record<string, string> = {
    wins: 'más victorias',
    eliminations: 'más eliminaciones',
    avg_placement: 'mejor puesto promedio',
    last_game_placement: 'mejor puesto en la última partida',
};

export default function FortniteStandingsSection({
    channelName,
    editionSlug,
    teamSize,
    live,
}: {
    channelName: string;
    editionSlug: string;
    teamSize: number;
    live: boolean;
}) {
    const [scopes, setScopes] = useState<Scope[] | null>(null);
    const [rules, setRules] = useState<Rules | null>(null);
    const [active, setActive] = useState<string | null>(null);
    const [openTeam, setOpenTeam] = useState<number | null>(null);
    const base = `/public/tournament/${channelName}/${editionSlug}/fortnite`;

    const load = async () => {
        try {
            const res = await api.get(`${base}/standings`);
            const list: Scope[] = res.data.scopes || [];
            setScopes(list);
            setRules(res.data.rules || null);
            // Por defecto la final si ya tiene equipos; si no, el primer ámbito.
            setActive((prev) => prev ?? (list.find((s) => s.isFinal && s.rows.length > 0) || list[0])?.key ?? null);
        } catch {
            setScopes([]);
        }
    };

    useEffect(() => {
        load();
        if (!live) return;
        const t = setInterval(load, 20000);
        return () => clearInterval(t);
    }, [channelName, editionSlug, live]);

    if (scopes == null) return null;
    const scope = scopes.find((s) => s.key === active) || scopes[0];

    return (
        <section className="space-y-4 4xl:space-y-6">
            <SectionLabel title="Clasificación" />
            {scopes.length > 1 && (
                <div className="flex gap-1.5 flex-wrap">
                    {scopes.map((s) => (
                        <button
                            key={s.key}
                            onClick={() => setActive(s.key)}
                            className={`font-mono text-[11px] 4xl:text-xs uppercase tracking-wider px-3 py-1.5 rounded border transition-colors ${
                                s.key === scope?.key ? 'border-[#3ED6C4] text-[#3ED6C4]' : 'border-[#232C42] text-[#7C8AA6] hover:text-[#EDF0F7]'
                            }`}
                        >
                            {s.isFinal && <Crown className="inline w-3 h-3 mr-1 -mt-0.5" />}
                            {s.name}
                        </button>
                    ))}
                </div>
            )}

            {!scope || scope.rows.length === 0 ? (
                <EmptyState text="Todavía no hay equipos en esta tabla." />
            ) : (
                <>
                    <p className="font-mono text-[11px] 4xl:text-xs text-[#7C8AA6]">
                        {scope.gamesWithResults}/{scope.gamesPlanned} partidas con resultados
                        {scope.qualifyCount ? ` · pasan a la final los ${scope.qualifyCount} primeros` : ''}
                        {scope.usesMatchPoint && rules?.matchPointThreshold ? ` · match point en ${rules.matchPointThreshold} pts` : ''}
                    </p>
                    <div className="border border-[#232C42] rounded-lg overflow-hidden">
                        <div className="hidden md:grid grid-cols-[48px_minmax(0,1fr)_80px_64px_64px_80px_64px_24px] gap-3 px-4 4xl:px-6 py-2 bg-[#131B2E] font-mono text-[10px] 4xl:text-xs uppercase tracking-wider text-[#7C8AA6]">
                            <span>#</span>
                            <span>{teamSize > 1 ? 'Equipo' : 'Jugador'}</span>
                            <span className="text-right">Puntos</span>
                            <span className="text-right">Vict.</span>
                            <span className="text-right">Elim.</span>
                            <span className="text-right">Prom.</span>
                            <span className="text-right">Part.</span>
                            <span />
                        </div>
                        <div className="divide-y divide-[#232C42]">
                            {scope.rows.map((r) => (
                                <div key={r.teamId} className="bg-[#0F1729]">
                                    <button
                                        onClick={() => setOpenTeam(openTeam === r.teamId ? null : r.teamId)}
                                        className="w-full text-left grid grid-cols-[40px_minmax(0,1fr)_72px_24px] md:grid-cols-[48px_minmax(0,1fr)_80px_64px_64px_80px_64px_24px] gap-3 items-center px-4 4xl:px-6 py-3 4xl:py-4 hover:bg-[#131B2E] transition-colors"
                                    >
                                        <span className={`font-mono font-bold 4xl:text-lg ${r.rank === 1 ? 'text-[#E8B04B]' : 'text-[#7C8AA6]'}`}>{r.rank}</span>
                                        <span className="min-w-0">
                                            <span className="flex items-center gap-2 flex-wrap">
                                                <span className="font-display font-bold text-[#EDF0F7] truncate 4xl:text-lg">{r.teamName}</span>
                                                {r.champion && (
                                                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#E8B04B]/15 text-[#E8B04B] flex items-center gap-1">
                                                        <Crown className="w-3 h-3" /> Campeón
                                                    </span>
                                                )}
                                                {!r.champion && r.matchPoint && (
                                                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#E8677A]/15 text-[#E8677A] flex items-center gap-1">
                                                        <Flame className="w-3 h-3" /> Match point
                                                    </span>
                                                )}
                                                {r.qualifies && (
                                                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#3ED6C4]/15 text-[#3ED6C4] flex items-center gap-1">
                                                        <ArrowUpRight className="w-3 h-3" /> Clasifica
                                                    </span>
                                                )}
                                            </span>
                                            {teamSize > 1 && r.members.length > 0 && (
                                                <span className="block font-mono text-[11px] text-[#7C8AA6] truncate">{r.members.join(' · ')}</span>
                                            )}
                                        </span>
                                        <span className="font-mono font-bold text-right text-[#EDF0F7] 4xl:text-lg">{r.points}</span>
                                        <span className="hidden md:block font-mono text-right text-[#EDF0F7]">{r.wins}</span>
                                        <span className="hidden md:block font-mono text-right text-[#EDF0F7]">{r.eliminations}</span>
                                        <span className="hidden md:block font-mono text-right text-[#7C8AA6]">{r.avgPlacement ?? '—'}</span>
                                        <span className="hidden md:block font-mono text-right text-[#7C8AA6]">{r.gamesPlayed}</span>
                                        {openTeam === r.teamId ? <ChevronDown className="w-4 h-4 text-[#7C8AA6]" /> : <ChevronRight className="w-4 h-4 text-[#7C8AA6]" />}
                                    </button>
                                    {openTeam === r.teamId && <TeamDetail base={base} teamId={r.teamId} row={r} />}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {rules && <RulesSummary rules={rules} />}
        </section>
    );
}

function TeamDetail({ base, teamId, row }: { base: string; teamId: number; row: Row }) {
    const [games, setGames] = useState<TeamGame[] | null>(null);
    const [zoom, setZoom] = useState<string | null>(null);

    useEffect(() => {
        api.get(`${base}/teams/${teamId}`).then((res) => setGames(res.data.games || [])).catch(() => setGames([]));
    }, [teamId]);

    return (
        <div className="px-4 4xl:px-6 pb-4 space-y-2">
            {/* En móvil las columnas extra no entran en la fila: van acá. */}
            <p className="md:hidden font-mono text-[11px] text-[#7C8AA6]">
                {row.wins} vict. · {row.eliminations} elim. · prom. {row.avgPlacement ?? '—'} · {row.gamesPlayed} part.
            </p>
            {games == null ? null : games.length === 0 ? (
                <p className="font-mono text-[11px] text-[#7C8AA6]">Todavía no tiene partidas con resultado.</p>
            ) : (
                games.map((g, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-[#131B2E]">
                        <span className="font-mono text-[11px] 4xl:text-xs text-[#7C8AA6]">
                            {g.sessionName} · partida {g.gameNumber}
                        </span>
                        <span className="flex items-center gap-2">
                            {g.screenshotFileIds.map((id) => (
                                <button key={id} onClick={() => setZoom(`${api.defaults.baseURL}${base}/files/${id}`)} className="w-12 h-8 rounded overflow-hidden hover:ring-2 ring-[#3ED6C4]">
                                    <img src={`${api.defaults.baseURL}${base}/files/${id}`} alt="Captura" className="w-full h-full object-cover" loading="lazy" />
                                </button>
                            ))}
                            <span className="font-mono text-xs 4xl:text-sm text-[#EDF0F7]">
                                {g.status === 'approved' ? `#${g.placement} · ${g.eliminations} elim. · ${g.points} pts` : g.status === 'rejected' ? 'Rechazado · 0 pts' : 'Sin reporte · 0 pts'}
                            </span>
                        </span>
                    </div>
                ))
            )}
            {zoom && (
                <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4" onClick={() => setZoom(null)}>
                    <img src={zoom} alt="Captura" className="max-w-full max-h-full object-contain rounded" />
                </div>
            )}
        </div>
    );
}

function RulesSummary({ rules }: { rules: Rules }) {
    const ranges = [...rules.placementPoints].sort((a, b) => a.from - b.from);
    return (
        <details className="rounded-lg border border-[#232C42] bg-[#0F1729]">
            <summary className="px-4 py-3 cursor-pointer font-display font-bold text-sm 4xl:text-base">Cómo se cuentan los puntos</summary>
            <div className="px-4 pb-4 space-y-2 font-mono text-[11px] 4xl:text-xs text-[#7C8AA6]">
                <div className="flex flex-wrap gap-1.5">
                    {ranges.map((r) => (
                        <span key={r.from} className="px-2 py-1 rounded bg-[#131B2E] text-[#EDF0F7]">
                            {r.from === r.to ? `#${r.from}` : `#${r.from}-${r.to}`}: {r.points} pts
                        </span>
                    ))}
                    <span className="px-2 py-1 rounded bg-[#131B2E] text-[#EDF0F7]">Eliminación: {rules.pointsPerElimination} pts</span>
                </div>
                {rules.tiebreakers.length > 0 && <p>Desempate: {rules.tiebreakers.map((t) => TIEBREAKERS[t] || t).join(', ')}.</p>}
                {rules.matchPointThreshold && (
                    <p>Match point: al llegar a {rules.matchPointThreshold} puntos, el equipo gana el torneo si gana una partida.</p>
                )}
            </div>
        </details>
    );
}
