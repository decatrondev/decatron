import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { NameAvatar, RoleBadge } from './shared';
import { SectionTitle, EmptyBlock } from './broadcast';

// Tab "Jugadores" (rediseño de transmisión): todos los inscritos aprobados, con su
// cuenta del juego y su equipo. La cuenta de Epic verificada lleva el escudo.

interface Player {
    id: number;
    displayName: string;
    riotId: string | null;
    riotTagLine: string | null;
    gameAccountName: string | null;
    gameAccountVerified: boolean;
    primaryRole: string | null;
    nationality: string | null;
    twitchChannel: string | null;
    kickChannel: string | null;
    teamId: number | null;
    teamName: string | null;
    isCaptain: boolean;
    isSubstitute: boolean;
}

export default function PlayersSection({ channelName, editionSlug }: { channelName: string; editionSlug: string }) {
    const [players, setPlayers] = useState<Player[] | null>(null);

    useEffect(() => {
        api.get(`/public/tournament/${channelName}/${editionSlug}/participants`)
            .then((res) => setPlayers(res.data?.participants || []))
            .catch(() => setPlayers([]));
    }, [channelName, editionSlug]);

    if (players == null) return null;

    return (
        <section>
            <SectionTitle meta={players.length > 0 ? `${players.length} ${players.length === 1 ? 'jugador' : 'jugadores'}` : undefined}>Jugadores</SectionTitle>
            {players.length === 0 ? (
                <EmptyBlock>Los jugadores aparecen aquí cuando el organizador aprueba su inscripción.</EmptyBlock>
            ) : (
                <ul className="grid grid-cols-1 lg:grid-cols-2 4xl:grid-cols-3 gap-x-4 gap-y-1">
                    {players.map((p) => {
                        const account = p.gameAccountName ?? (p.riotId ? `${p.riotId}#${p.riotTagLine}` : null);
                        return (
                            <li key={p.id} className="flex items-center gap-3 px-3 4xl:px-4 py-2.5 4xl:py-3" style={{ background: 'var(--t-surface)', boxShadow: 'inset 0 0 0 1px var(--t-line)' }}>
                                <NameAvatar name={p.displayName} size={34} />
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-2">
                                        <span className="font-semibold text-base 4xl:text-lg truncate">{p.displayName}</span>
                                        {p.primaryRole && <RoleBadge role={p.primaryRole} />}
                                    </span>
                                    <span className="flex items-center gap-1 text-sm 4xl:text-base truncate" style={{ color: 'var(--t-muted)' }}>
                                        {account ?? 'Sin cuenta vinculada'}
                                        {p.gameAccountName && p.gameAccountVerified && <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--t-accent)' }} aria-label="Verificada con Epic" />}
                                    </span>
                                </span>
                                {p.teamName && (
                                    <span className="text-sm 4xl:text-base text-right flex-shrink-0 max-w-[40%] truncate" style={{ color: 'var(--t-muted)' }}>
                                        {p.teamName}
                                        {p.isCaptain ? ' · capitán' : p.isSubstitute ? ' · suplente' : ''}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
