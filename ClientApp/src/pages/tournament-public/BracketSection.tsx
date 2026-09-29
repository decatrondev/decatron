import { useEffect, useState } from 'react';
import api from '../../services/api';
import { BRACKET_FORMAT_LABELS } from './shared';
import { SectionTitle, EmptyBlock } from './broadcast';
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
            <SectionTitle meta={bracketFormat ? BRACKET_FORMAT_LABELS[bracketFormat] || bracketFormat : undefined}>Bracket</SectionTitle>
            {matches.length === 0 || !bracketFormat ? (
                <EmptyBlock>El bracket aparece aquí cuando el organizador lo genera.</EmptyBlock>
            ) : bracketFormat === 'double_elimination' ? (
                <div className="space-y-10">
                    <div>
                        <h3 className="font-scoreboard font-extrabold text-2xl mb-6">Winners</h3>
                        <BracketTree matches={toBracketNodes(matches.filter((m) => m.bracketSide === 'winners'))} />
                    </div>
                    <div>
                        <h3 className="font-scoreboard font-extrabold text-2xl mb-6" style={{ color: 'var(--t-muted)' }}>Losers</h3>
                        <BracketTree matches={toBracketNodes(matches.filter((m) => m.bracketSide === 'losers'))} finalLabel="Final del losers" />
                    </div>
                    {matches.some((m) => m.bracketSide === 'grand_final') && (
                        <div>
                            <h3 className="font-scoreboard font-extrabold text-2xl mb-3" style={{ color: 'var(--t-gold)' }}>Gran final</h3>
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
                <div className="pt-6">
                    <BracketTree matches={toBracketNodes(matches)} />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 4xl:grid-cols-3 gap-x-8 4xl:gap-x-12 gap-y-6">
                    {rounds.map((round) => (
                        <div key={round}>
                            <h3 className="font-scoreboard font-extrabold text-xl 4xl:text-2xl mb-2">
                                {bracketFormat === 'round_robin' ? `Jornada ${round}` : `Ronda ${round}`}
                            </h3>
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
        </section>
    );
}

function PlainMatchRow({ match }: { match: BracketMatch }) {
    const side = (name: string | null, fallback: string) => {
        const won = !!name && match.winnerName === name;
        return (
            <span className={`flex-1 truncate ${won ? 'font-bold' : ''}`} style={{ color: won ? 'var(--t-accent)' : 'var(--t-ink)' }}>
                {name || fallback}
            </span>
        );
    };
    return (
        <div className="px-3 4xl:px-4 py-2.5 flex items-center gap-3 text-base 4xl:text-lg" style={{ background: 'var(--t-surface)', boxShadow: 'inset 0 0 0 1px var(--t-line)' }}>
            {side(match.teamAName, 'Por definir')}
            <span className="font-scoreboard font-black text-sm" style={{ color: 'var(--t-muted)' }}>vs</span>
            {side(match.teamBName, match.status === 'walkover' ? 'Pasa directo' : 'Por definir')}
        </div>
    );
}
