import { useEffect, useState } from 'react';
import api from '../../services/api';
import { SectionLabel, EmptyState, BRACKET_FORMAT_LABELS } from './shared';
import BracketTree from '../../components/tournament/BracketTree';

// Separado de TournamentPublicPage.tsx el 15-08-2026. Arbol real (components/
// tournament/BracketTree) agregado el 23-08-2026 — antes era una lista plana de
// matches, sin conectores ni jerarquia visual. single_elimination/double_elimination
// usan el arbol; round_robin/swiss no tienen forma de arbol (la cantidad de matches
// no se reduce a la mitad cada ronda), se listan por jornada/ronda.
//
// 24-08-2026: la grilla de equipos que vivia arriba del bracket se movio a
// TeamsSection.tsx (tab propia "Equipos") — este componente ahora es bracket puro.
// Sigue reusando el mismo endpoint /bracket (ya trae teams + matches), solo ignora
// "teams" y usa el vacio de matches para el EmptyState.

interface BracketMatch {
    id: number;
    roundNumber: number;
    bracketPosition: number;
    bracketSide: 'winners' | 'losers' | 'grand_final' | null;
    status: string;
    teamAId: number | null;
    teamAName: string | null;
    teamBId: number | null;
    teamBName: string | null;
    winnerName: string | null;
}

function toBracketNodes(matches: BracketMatch[]) {
    return matches.map((m) => ({
        id: m.id,
        roundNumber: m.roundNumber,
        bracketPosition: m.bracketPosition,
        teamAId: m.teamAId,
        teamAName: m.teamAName,
        teamBId: m.teamBId,
        teamBName: m.teamBName,
        winnerId: m.teamAName === m.winnerName ? m.teamAId : m.teamBName === m.winnerName ? m.teamBId : null,
        status: m.status,
    }));
}

export default function BracketSection({ channelName, editionSlug }: { channelName: string; editionSlug: string }) {
    const [matches, setMatches] = useState<BracketMatch[]>([]);
    const [bracketFormat, setBracketFormat] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get(`/public/tournament/${channelName}/${editionSlug}/bracket`);
                if (res.data?.success) {
                    setMatches(res.data.matches || []);
                    setBracketFormat(res.data.bracketFormat || null);
                }
            } catch (err) {
                console.error('Error cargando bracket', err);
            } finally {
                setLoading(false);
            }
        })();
    }, [channelName, editionSlug]);

    if (loading) return null;

    const isTree = bracketFormat === 'single_elimination' || bracketFormat === 'double_elimination';
    const rounds = Array.from(new Set(matches.map((m) => m.roundNumber))).sort((a, b) => a - b);

    return (
        <section>
            <SectionLabel title="Bracket" />
            {matches.length === 0 || !bracketFormat ? (
                <EmptyState text="Todavía no hay bracket generado." />
            ) : (
                <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#3ED6C4] mb-3">
                        {BRACKET_FORMAT_LABELS[bracketFormat] || bracketFormat}
                    </p>

                    {bracketFormat === 'double_elimination' ? (
                        <div className="space-y-8">
                            <div>
                                <p className="text-xs font-bold text-[#3ED6C4] mb-2 font-mono uppercase tracking-wide">Winners</p>
                                <BracketTree matches={toBracketNodes(matches.filter((m) => m.bracketSide === 'winners'))} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-[#7C8AA6] mb-2 font-mono uppercase tracking-wide">Losers</p>
                                <BracketTree
                                    matches={toBracketNodes(matches.filter((m) => m.bracketSide === 'losers'))}
                                    finalLabel="Final del losers"
                                />
                            </div>
                            {matches.some((m) => m.bracketSide === 'grand_final') && (
                                <div>
                                    <p className="text-xs font-bold text-[#E8B04B] mb-2 font-mono uppercase tracking-wide">Gran final</p>
                                    <div className="space-y-1.5 max-w-md">
                                        {matches
                                            .filter((m) => m.bracketSide === 'grand_final')
                                            .sort((a, b) => a.roundNumber - b.roundNumber)
                                            .map((m) => (
                                                <PlainMatchRow key={m.id} match={m} />
                                            ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : isTree ? (
                        <BracketTree matches={toBracketNodes(matches)} />
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 4xl:grid-cols-3 gap-x-8 4xl:gap-x-12 gap-y-6">
                            {rounds.map((round) => (
                                <div key={round}>
                                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#7C8AA6] mb-1.5">
                                        {bracketFormat === 'round_robin' ? `Jornada ${round}` : `Ronda ${round}`}
                                    </p>
                                    <div className="space-y-1.5">
                                        {matches
                                            .filter((m) => m.roundNumber === round)
                                            .map((m) => (
                                                <PlainMatchRow key={m.id} match={m} />
                                            ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

function PlainMatchRow({ match }: { match: BracketMatch }) {
    return (
        <div className="px-3 py-2 rounded-lg border border-[#232C42] bg-[#0F1729] flex items-center gap-2 text-sm font-mono">
            <span className={match.winnerName === match.teamAName ? 'font-bold text-[#3ED6C4]' : 'text-[#EDF0F7]'}>{match.teamAName || 'TBD'}</span>
            <span className="text-[#7C8AA6] text-xs">vs</span>
            <span className={match.winnerName === match.teamBName ? 'font-bold text-[#3ED6C4]' : 'text-[#EDF0F7]'}>
                {match.teamBName || (match.status === 'walkover' ? '(bye)' : 'TBD')}
            </span>
        </div>
    );
}
