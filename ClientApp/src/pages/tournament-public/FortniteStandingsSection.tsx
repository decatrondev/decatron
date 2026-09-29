import { useEffect, useState, type ReactNode } from 'react';
import { Crown, Flame, ArrowUpRight, X } from 'lucide-react';
import api from '../../services/api';
import { SectionTitle, EmptyBlock, PointsBars, RowBadge, type BarRow } from './broadcast';

// Clasificación de Fortnite (.dev/torneos/15-fortnite.md F5) con el diseño de
// transmisión (16-rediseno-publico.md): una tabla por ámbito (lobby único, cada
// grupo, final) como barras de puntos, con match point, clasificados y el detalle
// partida por partida de cada equipo. Se refresca sola mientras el torneo está en juego.

export interface StandingsRow {
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

export interface StandingsScope {
    key: string;
    name: string;
    isFinal: boolean;
    qualifyCount: number | null;
    gamesPlanned: number;
    gamesWithResults: number;
    usesMatchPoint: boolean;
    rows: StandingsRow[];
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

/** La tabla principal: la final si ya tiene equipos, si no la primera. */
export function mainScope(scopes: StandingsScope[]): StandingsScope | undefined {
    return scopes.find((s) => s.isFinal && s.rows.length > 0) || scopes[0];
}

export function useFortniteStandings(channelName: string, editionSlug: string, live: boolean) {
    const [scopes, setScopes] = useState<StandingsScope[] | null>(null);
    const [rules, setRules] = useState<Rules | null>(null);

    useEffect(() => {
        const load = () =>
            api
                .get(`/public/tournament/${channelName}/${editionSlug}/fortnite/standings`)
                .then((res) => {
                    setScopes(res.data.scopes || []);
                    setRules(res.data.rules || null);
                })
                .catch(() => setScopes([]));
        load();
        if (!live) return;
        const t = setInterval(load, 20000);
        return () => clearInterval(t);
    }, [channelName, editionSlug, live]);

    return { scopes, rules };
}

export function standingsToBars(scope: StandingsScope, teamSize: number, detailFor?: (row: StandingsRow) => ReactNode): BarRow[] {
    return scope.rows.map((r) => ({
        key: r.teamId,
        rank: r.rank,
        name: r.teamName,
        sub: teamSize > 1 && r.members.length > 0 ? r.members.join(', ') : `${r.wins} ${r.wins === 1 ? 'victoria' : 'victorias'} · ${r.eliminations} eliminaciones`,
        value: r.points,
        valueText: `${r.points}`,
        badges: (
            <>
                {r.champion && (
                    <RowBadge tone="gold">
                        <Crown className="w-3 h-3" /> Campeón
                    </RowBadge>
                )}
                {!r.champion && r.matchPoint && (
                    <RowBadge tone="live">
                        <Flame className="w-3 h-3" /> Match point
                    </RowBadge>
                )}
                {r.qualifies && (
                    <RowBadge tone="accent">
                        <ArrowUpRight className="w-3 h-3" /> Clasifica
                    </RowBadge>
                )}
            </>
        ),
        detail: detailFor?.(r),
    }));
}

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
    const { scopes, rules } = useFortniteStandings(channelName, editionSlug, live);
    const [active, setActive] = useState<string | null>(null);
    const [openTeam, setOpenTeam] = useState<string | number | null>(null);
    const base = `/public/tournament/${channelName}/${editionSlug}/fortnite`;

    if (scopes == null) return null;
    const scope = scopes.find((s) => s.key === active) || mainScope(scopes);

    return (
        <section>
            <SectionTitle
                meta={
                    scope && scope.gamesPlanned > 0
                        ? `${scope.gamesWithResults} de ${scope.gamesPlanned} partidas con resultados${scope.qualifyCount ? ` · pasan a la final los ${scope.qualifyCount} primeros` : ''}${
                              scope.usesMatchPoint && rules?.matchPointThreshold ? ` · match point en ${rules.matchPointThreshold} puntos` : ''
                          }`
                        : undefined
                }
                action={
                    scopes.length > 1 ? (
                        <div className="flex gap-1 flex-wrap" role="tablist">
                            {scopes.map((s) => {
                                const on = s.key === scope?.key;
                                return (
                                    <button
                                        key={s.key}
                                        role="tab"
                                        aria-selected={on}
                                        onClick={() => setActive(s.key)}
                                        className="px-3 py-1.5 font-scoreboard font-extrabold text-base 4xl:text-lg"
                                        style={on ? { background: 'var(--t-ink)', color: 'var(--t-bg)' } : { background: 'var(--t-surface-raised)', color: 'var(--t-muted)' }}
                                    >
                                        {s.isFinal && <Crown className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
                                        {s.name}
                                    </button>
                                );
                            })}
                        </div>
                    ) : undefined
                }
            >
                Clasificación
            </SectionTitle>

            {!scope || scope.rows.length === 0 ? (
                <EmptyBlock>Los equipos aparecen aquí cuando el organizador los arma.</EmptyBlock>
            ) : (
                <PointsBars
                    rows={standingsToBars(scope, teamSize, (r) => <TeamDetail base={base} teamId={r.teamId} row={r} />)}
                    expandedKey={openTeam}
                    onToggle={(k) => setOpenTeam(openTeam === k ? null : k)}
                />
            )}

            {rules && <RulesSummary rules={rules} />}
        </section>
    );
}

function TeamDetail({ base, teamId, row }: { base: string; teamId: number; row: StandingsRow }) {
    const [games, setGames] = useState<TeamGame[] | null>(null);
    const [zoom, setZoom] = useState<string | null>(null);

    useEffect(() => {
        api.get(`${base}/teams/${teamId}`).then((res) => setGames(res.data.games || [])).catch(() => setGames([]));
    }, [teamId]);

    const stats: [string, string | number][] = [
        ['Victorias', row.wins],
        ['Eliminaciones', row.eliminations],
        ['Puesto promedio', row.avgPlacement ?? '—'],
        ['Partidas', row.gamesPlayed],
    ];

    return (
        <div className="pt-4 space-y-4">
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {stats.map(([k, v]) => (
                    <div key={k} className="px-3 py-2" style={{ background: 'var(--t-surface-raised)' }}>
                        <dt className="text-sm" style={{ color: 'var(--t-muted)' }}>{k}</dt>
                        <dd className="font-scoreboard font-black text-2xl 4xl:text-3xl leading-tight">{v}</dd>
                    </div>
                ))}
            </dl>
            {games == null ? null : games.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--t-muted)' }}>Todavía no tiene partidas con resultado.</p>
            ) : (
                <ul className="space-y-1">
                    {games.map((g, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 px-3 py-2" style={{ background: 'var(--t-surface-raised)' }}>
                            <span className="text-sm 4xl:text-base" style={{ color: 'var(--t-muted)' }}>
                                {g.sessionName}, partida {g.gameNumber}
                            </span>
                            <span className="flex items-center gap-2">
                                {g.screenshotFileIds.map((id) => (
                                    <button
                                        key={id}
                                        onClick={() => setZoom(`${api.defaults.baseURL}${base}/files/${id}`)}
                                        className="w-12 h-8 overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--t-accent)]"
                                        title="Ver captura"
                                    >
                                        <img src={`${api.defaults.baseURL}${base}/files/${id}`} alt="Captura del resultado" className="w-full h-full object-cover" loading="lazy" />
                                    </button>
                                ))}
                                <span className="font-semibold text-sm 4xl:text-base">
                                    {g.status === 'approved' ? (
                                        <>
                                            Puesto {g.placement} · {g.eliminations} elim. ·{' '}
                                            <span className="font-scoreboard font-black text-lg">{g.points}</span> pts
                                        </>
                                    ) : g.status === 'rejected' ? (
                                        'Rechazado, 0 pts'
                                    ) : (
                                        'Sin reporte, 0 pts'
                                    )}
                                </span>
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            {zoom && (
                <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4" onClick={() => setZoom(null)} role="dialog" aria-label="Captura">
                    <button className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white" onClick={() => setZoom(null)} aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                    <img src={zoom} alt="Captura del resultado" className="max-w-full max-h-full object-contain" />
                </div>
            )}
        </div>
    );
}

function RulesSummary({ rules }: { rules: Rules }) {
    const ranges = [...rules.placementPoints].sort((a, b) => a.from - b.from);
    return (
        <details className="mt-4 group" style={{ background: 'var(--t-surface)', boxShadow: 'inset 0 0 0 1px var(--t-line)' }}>
            <summary className="px-4 4xl:px-6 py-3 cursor-pointer font-semibold text-base 4xl:text-lg list-none flex items-center justify-between">
                Cómo se cuentan los puntos
                <span className="text-sm group-open:hidden" style={{ color: 'var(--t-muted)' }}>Ver</span>
            </summary>
            <div className="px-4 4xl:px-6 pb-4 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                    {ranges.map((r) => (
                        <span key={r.from} className="px-2.5 py-1 text-sm 4xl:text-base" style={{ background: 'var(--t-surface-raised)' }}>
                            {r.from === r.to ? `Puesto ${r.from}` : `Puestos ${r.from} a ${r.to}`}: <strong>{r.points}</strong>
                        </span>
                    ))}
                    <span className="px-2.5 py-1 text-sm 4xl:text-base" style={{ background: 'var(--t-surface-raised)' }}>
                        Cada eliminación: <strong>{rules.pointsPerElimination}</strong>
                    </span>
                </div>
                {rules.tiebreakers.length > 0 && (
                    <p className="text-sm 4xl:text-base" style={{ color: 'var(--t-muted)' }}>
                        Si hay empate en puntos gana el que tenga {rules.tiebreakers.map((t) => TIEBREAKERS[t] || t).join(', luego ')}.
                    </p>
                )}
                {rules.matchPointThreshold && (
                    <p className="text-sm 4xl:text-base" style={{ color: 'var(--t-muted)' }}>
                        Match point: al llegar a {rules.matchPointThreshold} puntos, el equipo gana el torneo si gana una partida.
                    </p>
                )}
            </div>
        </details>
    );
}
