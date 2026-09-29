import { useEffect, useState } from 'react';
import api from '../../services/api';
import { NameAvatar } from './shared';
import { SectionTitle, EmptyBlock } from './broadcast';

// Tab "Equipos" (rediseño de transmisión, 16-rediseno-publico.md): una placa por
// equipo con su plantel. Usa el endpoint /bracket, que ya trae los equipos.

interface Team {
    id: number;
    name: string;
    seed: number | null;
    roster: { displayName: string; isCaptain: boolean; isSubstitute: boolean }[];
}

export default function TeamsSection({ channelName, editionSlug }: { channelName: string; editionSlug: string }) {
    const [teams, setTeams] = useState<Team[] | null>(null);

    useEffect(() => {
        api.get(`/public/tournament/${channelName}/${editionSlug}/bracket`)
            .then((res) => setTeams(res.data?.teams || []))
            .catch(() => setTeams([]));
    }, [channelName, editionSlug]);

    if (teams == null) return null;

    return (
        <section>
            <SectionTitle meta={teams.length > 0 ? `${teams.length} ${teams.length === 1 ? 'equipo' : 'equipos'}` : undefined}>Equipos</SectionTitle>
            {teams.length === 0 ? (
                <EmptyBlock>Los equipos aparecen aquí cuando se arman.</EmptyBlock>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 4xl:grid-cols-4 5xl:grid-cols-5 gap-2 4xl:gap-3">
                    {teams.map((t) => (
                        <li key={t.id} className="p-4 4xl:p-5" style={{ background: 'var(--t-surface)', boxShadow: 'inset 3px 0 0 var(--t-secondary), inset 0 0 0 1px var(--t-line)' }}>
                            <div className="flex items-center gap-2.5">
                                <NameAvatar name={t.name} size={30} />
                                <p className="font-scoreboard font-black text-2xl 4xl:text-3xl leading-none truncate">{t.name}</p>
                            </div>
                            <ul className="mt-3 space-y-1">
                                {t.roster.map((m, i) => (
                                    <li key={i} className="flex items-center justify-between gap-2 text-base 4xl:text-lg">
                                        <span className="truncate">{m.displayName}</span>
                                        {(m.isCaptain || m.isSubstitute) && (
                                            <span className="text-sm flex-shrink-0" style={{ color: 'var(--t-muted)' }}>
                                                {m.isCaptain ? 'Capitán' : 'Suplente'}
                                            </span>
                                        )}
                                    </li>
                                ))}
                                {t.roster.length === 0 && (
                                    <li className="text-sm" style={{ color: 'var(--t-muted)' }}>
                                        Sin jugadores todavía
                                    </li>
                                )}
                            </ul>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
